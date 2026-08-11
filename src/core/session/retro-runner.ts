// Retro runner (V3/03) — spawns a FRESH, ISOLATED Retro window after the user resolves a Reviewer
// blocker. It sees ONLY { task, misunderstanding, answer } (never the Worker's/Reviewer's turns —
// CLAUDE.md memory model), diagnoses the root cause, and patches EXACTLY ONE file so the mistake can't
// recur. The window is one-shot: discarded when spawnRetro returns.
//
// Two edit roots, per the design decision (two narrow tools, one per root):
//   - TASK-SPECIFIC → the project doc, via the project-scoped edit_file (+ read tools) dispatched
//     through the shared registry (host-side, scoped under projects/<active>).
//   - SYSTEMIC → a global phase file under rules/phases/, via the phase-scoped edit_phase_rule /
//     read_phase_rule handled directly in this window (the registry tools can't reach rules/).
//
// TWO INVARIANTS the orchestrator enforces itself (never trusting the model):
//   1. ONE file per Retro. The window locks onto the first file it SUCCESSFULLY edits; a later edit to
//      a DIFFERENT file is refused (recoverable) and the model is told to re-classify. Two files = a
//      mis-classification.
//   2. The commit fate is decided by the RESOLVED edited path, not the model's submitted scope: under
//      rules/phases/ ⇒ systemic ⇒ NEVER auto-committed, left uncommitted + a loud review warning; under
//      projects/<active>/ ⇒ task-specific ⇒ committed with the project's work.

import path from 'node:path';

import { availablePhaseNames, buildSystemPrompt, loadPhasePrompt, phasePromptPath, PHASES_DIR } from '../../context/index.js';
import { PHASE_SCOPED_TOOL_NAMES, RETRO_TOOL_NAMES, resolvePhaseTools } from '../../phases/index.js';
import { createToolContext, resolveInProject, toolError } from '../../tools/index.js';
import { buildFileDiff } from '../../tools/build-file-diff.js';
import { applyPhaseRuleEdit, EDIT_PHASE_RULE } from '../../tools/edit-phase-rule.js';
import { READ_PHASE_RULE, readPhaseRule } from '../../tools/read-phase-rule.js';
import { parseRetroSubmission, SUBMIT_RETRO } from '../../tools/submit-retro.js';
import type { Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import type { ToolCallDisplay } from '../ui/tool-call-display.type.js';
import { addTokenCounts } from './add-token-counts.js';
import { recordToolCall } from './record-tool-call.js';
import type { ToolCallRecord } from './dispatch.js';
import { dispatchToolCall } from './dispatch.js';
import { createReadTracker } from './read-tracker.js';
import type { FileReadTracker } from './read-tracker.type.js';
import { commitPaths } from './project-git.js';
import type { RetroDeps, RetroInput, RetroResult, RetroSubmission } from './retro-runner.type.js';
import { processMessage } from './turn-loop.js';
import type { TurnContext } from './turn-loop.js';
import type { Task } from './types.js';

// Retro reads a couple of files (task doc / phase file) then makes one edit and submits — lighter than
// the Worker's implement loop. Give headroom for a few reads + a re-tried edit before the cap trips.
const RETRO_MAX_ROUNDS = 16;

// The project-scoped registry tools Retro may use: inspect the backlog/spec, make a TASK-SPECIFIC
// edit, and signal other phases via the cross-phase inbox (V3/04). No write_file (Retro makes the
// SMALLEST edit, not a rewrite), no shell/container tools. The inbox tools neither read nor touch the
// single-file edit lock — they go through the read/inbox dispatch branch below.
// The registry tools Retro may dispatch — its array from phase-tool-names.ts minus the phase-scoped
// tools this window answers itself (read_phase_rule / edit_phase_rule / submit_retro). callTool routes
// on this; the definitions sent to the model come from resolvePhaseTools('retro'), one shared array.
const RETRO_PROJECT_TOOL_NAMES: readonly string[] = RETRO_TOOL_NAMES.filter(
  (name) => !PHASE_SCOPED_TOOL_NAMES.includes(name),
);

/** The project-scoped edit tool whose success locks the window's single-file target. */
const PROJECT_EDIT_TOOL = 'edit_file';

/** Retro ended without a usable outcome (never edited a file, or never submitted its diagnosis). */
export class RetroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetroError';
  }
}

/**
 * Detect a structured recoverable error in a dispatched tool's string result (the shape the file tools
 * return via toolError: a JSON object carrying an `error` field). A plain-string result is a success
 * (e.g. edit_file's "Edited '...'."). Used to lock the single-file target ONLY on a real edit.
 */
function isToolErrorResult(result: string): boolean {
  try {
    const parsed: unknown = JSON.parse(result);
    return typeof parsed === 'object' && parsed !== null && typeof (parsed as Record<string, unknown>)['error'] === 'string';
  } catch {
    return false; // not JSON ⇒ a plain success string
  }
}

/** True when `abs` resolves to `root` itself or strictly under it (the path-guard primitive). */
function isUnder(abs: string, root: string): boolean {
  const r = path.resolve(root);
  const a = path.resolve(abs);
  return a === r || a.startsWith(r + path.sep);
}

/**
 * A single Retro window implementing the turn loop's TurnContext against its OWN messages array —
 * isolated from the session's per-phase histories and from the Worker/Reviewer. Project read/edit tools
 * dispatch through the shared registry (audited as phase "retro"); the rules-scoped read/edit and
 * submit_retro are handled here directly. The one-file lock spans BOTH edit roots.
 */
class RetroWindow implements TurnContext {
  readonly activePhase = 'retro';
  readonly messages: Message[];

  /** The project read/edit subset + the rules read/edit tools + submit_retro, sent to the model every turn. */
  private readonly retroTools: Tool[];
  /** Running EXACT sum across every turn (a null metric poisons the sum — never estimated). */
  private tokenSum: TokenCounts = { promptTokens: 0, evalTokens: 0 };
  /** Absolute path of the ONE file this Retro has successfully edited — the single-file lock. */
  private edited: string | null = null;
  /** The captured diagnosis — null until submit_retro succeeds; makes the window terminal. */
  private captured: RetroSubmission | null = null;
  /**
   * This window's read tracker, backing the guard on `edit_file` — Retro's only write. It pairs well
   * with the single-file lock below: Retro is told to make ONE smallest edit, and it now has to have
   * read that file before it can make it.
   */
  private readonly readTracker: FileReadTracker = createReadTracker();

  constructor(
    private readonly deps: RetroDeps,
    systemPrompt: string,
  ) {
    this.messages = [{ role: 'system', content: systemPrompt }];
    // One array covers both halves: the project read/edit + inbox tools AND the phase-scoped trio. The
    // rules-scoped pair and submit_retro are never in the global registry — so no other phase (nor the
    // Worker's tool list) can reach rules/phases/ or end a Retro.
    this.retroTools = resolvePhaseTools('retro');
  }

  /** Absolute path of the single file Retro patched, or null if it never made a successful edit. */
  get editedFile(): string | null {
    return this.edited;
  }

  /** The captured diagnosis, or null if the Retro never submitted one. */
  get submission(): RetroSubmission | null {
    return this.captured;
  }

  /** Exact summed tokens across every turn of this window (for the whole-Retro cost). */
  get tokens(): TokenCounts {
    return this.tokenSum;
  }

  streamAsk(userInput: string): StreamHandle {
    this.messages.push({ role: 'user', content: userInput });
    return this.deps.llm.stream(this.messages, this.retroTools);
  }

  streamContinue(): StreamHandle {
    return this.deps.llm.stream(this.messages, this.retroTools);
  }

  onTokens(tokens: TokenCounts): void {
    this.tokenSum = addTokenCounts(this.tokenSum, tokens);
  }

  addAssistant(content: string, toolCalls?: ToolCall[]): void {
    const entry: Message = { role: 'assistant', content };
    if (toolCalls && toolCalls.length > 0) {
      entry.tool_calls = toolCalls;
    }
    this.messages.push(entry);
  }

  addToolResult(toolName: string, result: string): void {
    this.messages.push({ role: 'tool', content: result, tool_name: toolName });
  }

  /** Terminal once submit_retro captured a diagnosis — ends the turn loop immediately. */
  isComplete(): boolean {
    return this.captured !== null;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (name === SUBMIT_RETRO) {
      return this.captureSubmission(args);
    }
    if (name === READ_PHASE_RULE) {
      return this.handleReadPhaseRule(args);
    }
    if (name === EDIT_PHASE_RULE) {
      return this.handleEditPhaseRule(args);
    }
    if (name === PROJECT_EDIT_TOOL) {
      return this.handleProjectEdit(args);
    }
    if (RETRO_PROJECT_TOOL_NAMES.includes(name)) {
      return this.dispatchProject(name, args); // a read or inbox tool — no single-file lock to enforce
    }
    // Any other tool (write_file, shell/container, unknown) is refused — Retro makes ONE smallest edit.
    return this.refuse(name, args);
  }

  // ------------------------------------------------------------------------------- project edit path

  /**
   * A TASK-SPECIFIC edit via the project-scoped edit_file. Enforce the single-file lock BEFORE mutating
   * (resolve the target under the project root; a second, different file is refused), dispatch through
   * the shared registry, then lock onto the target ONLY if the edit actually succeeded.
   */
  private async handleProjectEdit(args: Record<string, unknown>): Promise<string> {
    let target: string | null = null;
    const rel = args['path'];
    if (typeof rel === 'string') {
      // Resolve for the lock check only; an escaping path throws — let dispatch reproduce that error.
      try {
        target = resolveInProject(this.deps.projectPath, rel);
      } catch {
        target = null;
      }
    }
    if (target !== null) {
      const refusal = this.secondFileRefusal(PROJECT_EDIT_TOOL, args, target);
      if (refusal !== null) return refusal;
    }
    const result = await this.dispatchProject(PROJECT_EDIT_TOOL, args);
    if (target !== null && !isToolErrorResult(result)) {
      this.edited = target; // lock on a real edit
    }
    return result;
  }

  /** Dispatch a project read/edit tool through the shared registry (audited as phase "retro"). */
  private dispatchProject(name: string, args: Record<string, unknown>): Promise<string> {
    const ctx = createToolContext({
      projectName: this.deps.projectName,
      projectPath: this.deps.projectPath,
      sandbox: this.deps.sandbox,
      phase: 'retro',
      llm: this.deps.llm, // required by createToolContext; Retro's tools don't use ctx.oneShot
      readTracker: this.readTracker, // this window's own — backs the guard on Retro's one edit_file
    });
    return dispatchToolCall(ctx, name, args, {
      onToolCall: (record) => recordToolCall(this.deps.projectPath, record),
    });
  }

  // -------------------------------------------------------------------------------- rules edit path

  /** A read of a global phase file (rules/phases/<phase>.md) — read-only, no single-file lock. */
  private handleReadPhaseRule(args: Record<string, unknown>): string {
    const start = performance.now();
    const read = readPhaseRule(args['phase']);
    if (!read.ok) {
      const output = JSON.stringify(read.hint === undefined ? { error: read.error } : { error: read.error, hint: read.hint });
      this.audit(READ_PHASE_RULE, args, -1, output, read.error, start);
      return output;
    }
    const lines = read.content === '' ? 0 : read.content.split('\n').length;
    this.audit(READ_PHASE_RULE, args, 0, read.content, null, start, { summary: `${lines} line${lines === 1 ? '' : 's'}` });
    return read.content;
  }

  /**
   * A SYSTEMIC edit of a global phase file. Enforce the single-file lock BEFORE mutating (a valid, but
   * DIFFERENT, phase file is refused), then apply the smallest-correct exact-once replace. Lock onto the
   * resolved path only on success. The write is left UNCOMMITTED — the path guard routes it to the
   * review-warning branch downstream.
   */
  private handleEditPhaseRule(args: Record<string, unknown>): string {
    const start = performance.now();
    const target = candidatePhaseFile(args['phase']);
    if (target !== null) {
      const refusal = this.secondFileRefusal(EDIT_PHASE_RULE, args, target, start);
      if (refusal !== null) return refusal;
    }
    const edit = applyPhaseRuleEdit(args['phase'], args['old_string'], args['new_string']);
    if (!edit.ok) {
      const output = JSON.stringify(edit.hint === undefined ? { error: edit.error } : { error: edit.error, hint: edit.hint });
      this.audit(EDIT_PHASE_RULE, args, -1, output, edit.error, start);
      return output;
    }
    this.edited = edit.resolvedPath; // lock on a real edit
    const output = `Patched global phase file rules/phases/${edit.phase}.md (UNCOMMITTED — it will need your review before continuing).`;
    // buildFileDiff over the file's text either side of the patch: this is the one edit in the product
    // that a human is REQUIRED to review before the session continues, so the diff belongs on screen.
    const rel = `rules/phases/${edit.phase}.md`;
    const diff = buildFileDiff(rel, edit.before, edit.after);
    const summary = diff === null ? 'patched (uncommitted)' : `+${diff.added} −${diff.removed} (uncommitted)`;
    this.audit(EDIT_PHASE_RULE, args, 0, output, null, start, diff === null ? { summary } : { summary, diff });
    return output;
  }

  // --------------------------------------------------------------------------------- submit + guards

  /**
   * Capture submit_retro: require that a file was ALREADY edited (Retro's contract is edit-then-submit),
   * validate the payload, then store the diagnosis and go terminal. A premature or malformed call is a
   * RECOVERABLE structured error — the turn continues so the model can edit/re-submit.
   */
  private captureSubmission(args: Record<string, unknown>): string {
    const start = performance.now();
    if (this.edited === null) {
      const err = toolError(
        'No file was edited yet — Retro must patch exactly one file before submitting.',
        'Make your single edit first: edit_file for the project doc (task-specific), or edit_phase_rule for a global phase file (systemic). Then call submit_retro.',
      );
      const output = JSON.stringify(err.content);
      this.audit(SUBMIT_RETRO, args, -1, output, err.error ?? 'no edit yet', start);
      return output;
    }
    const parsed = parseRetroSubmission(args);
    if (!parsed.ok) {
      const err = toolError(`Invalid submit_retro: ${parsed.error}`, 'Fix the fields and call submit_retro again.');
      const output = JSON.stringify(err.content);
      this.audit(SUBMIT_RETRO, args, -1, output, err.error ?? parsed.error, start);
      return output;
    }
    this.captured = parsed.submission;
    const output = `Retro recorded: ${parsed.submission.scope} — ${parsed.submission.rootCause}`;
    this.audit(SUBMIT_RETRO, args, 0, output, null, start, { summary: `recorded — ${parsed.submission.scope}` });
    return output;
  }

  /**
   * The single-file guard: if a file was already edited and `target` is a DIFFERENT file, refuse (a
   * recoverable error telling the model to re-classify and touch only one file). Returns the refusal
   * string, or null when the target is allowed (first edit, or the same file again).
   */
  private secondFileRefusal(
    tool: string,
    args: Record<string, unknown>,
    target: string,
    startedAt: number = performance.now(),
  ): string | null {
    if (this.edited === null || target === this.edited) {
      return null;
    }
    const err = toolError(
      `You already edited '${this.edited}'. A Retro patches EXACTLY ONE file — editing a second means you mis-classified.`,
      'Re-check: systemic (a global phase file) OR task-specific (the project doc), then edit only that ONE file and call submit_retro.',
    );
    const output = JSON.stringify(err.content);
    this.audit(tool, args, -1, output, err.error ?? 'second file rejected', startedAt);
    return output;
  }

  /** Refuse a tool Retro must not use (write_file, shell/container, unknown), recoverably + audited. */
  private refuse(name: string, args: Record<string, unknown>): string {
    const err = toolError(
      `tool '${name}' is not available to the Retro phase — it makes ONE smallest edit, not arbitrary changes.`,
      'Inspect with read_file / list_files / search_in_files / read_phase_rule; edit with edit_file (project doc) or edit_phase_rule (global phase file); then submit_retro.',
    );
    const output = JSON.stringify(err.content);
    this.audit(name, args, -1, output, err.error ?? `tool '${name}' not available`, performance.now());
    return output;
  }

  /**
   * Record one call this window handles directly (the rules-scoped pair, submit_retro, a refusal): its
   * audit row AND its `←` line. These never reach the shared dispatcher, so without this they would be
   * the calls with no result line at all. `display` is the tool's own words plus, for a rules edit, the
   * diff itself; omitted, the line falls back to `error`.
   */
  private audit(
    tool: string,
    args: Record<string, unknown>,
    exitStatus: number,
    output: string,
    error: string | null,
    startedAt: number,
    display?: ToolCallDisplay,
  ): void {
    const record: ToolCallRecord = {
      ts: new Date().toISOString(),
      phase: 'retro',
      tool,
      args,
      exitStatus,
      durationMs: Math.round(performance.now() - startedAt),
      output,
      error,
      ...(display !== undefined ? { display } : {}),
    };
    recordToolCall(this.deps.projectPath, record);
  }
}

/**
 * The absolute rules/phases/<phase>.md path for a candidate `phase` arg (for the single-file lock check),
 * or null if it isn't an existing phase file — so an unknown-phase edit falls through to
 * applyPhaseRuleEdit's own error instead of being mis-reported as a "second file".
 */
function candidatePhaseFile(phase: unknown): string | null {
  if (typeof phase !== 'string' || phase.trim() === '') return null;
  const normalized = phase.trim().toLowerCase();
  return availablePhaseNames().includes(normalized) ? phasePromptPath(normalized) : null;
}

// --------------------------------------------------------------------------------------- seed + spawn

/** Assemble the seed user message: the inputs + the classification rules + the tool + one-file contract. */
function buildRetroSeed(input: RetroInput): string {
  const { task, misunderstanding, answer, failedAttempt } = input;
  // The stashed failed attempt (V3/05) is advisory evidence of HOW the ambiguity misled implementation —
  // included only when present; never presented as correct (the Worker redoes the task from scratch).
  const attemptSection =
    failedAttempt !== undefined && failedAttempt.trim() !== ''
      ? `\n## The failed Worker attempt that triggered the blocker (stashed diff — evidence, NOT correct code)
Use this to see HOW the ambiguous task misled implementation; do not treat it as a solution to preserve.
\`\`\`diff
${failedAttempt.trim()}
\`\`\`
`
      : '';
  return `You are the Retro phase. A Reviewer raised a blocker on ONE task, the user answered it, and your job is to make the SMALLEST edit to ONE file so this class of misunderstanding cannot recur. Diagnose the ROOT cause — what upstream gap let an ambiguous task reach execution — classify it, patch exactly one file, then call ${SUBMIT_RETRO}.

## Task that blocked: ${task.title}
(backlog id: ${task.id})

${task.body}

## The misunderstanding (the Reviewer's blocker question)
${misunderstanding}

## The user's resolving answer
${answer}
${attemptSection}
How to patch (choose ONE file — editing two means you mis-classified):
- SYSTEMIC gap — a question the protocol should ALWAYS ask, or a check the Reviewer should ALWAYS run (it should have been caught in Discovery / Design / Review). Fix the matching GLOBAL phase file: read it with ${READ_PHASE_RULE}, then patch it with ${EDIT_PHASE_RULE} (discovery | design | breakdown | worker | reviewer). This edit is left UNCOMMITTED for the user to review.
- TASK-SPECIFIC gap — a one-off hole in THIS task's wording or acceptance criteria. Fix the project doc: read it with read_file, then patch the task's backlog file (or PRODUCT_SPEC.md) with edit_file.
- You may inspect first with read_file / list_files / search_in_files / ${READ_PHASE_RULE}.
- Make the SMALLEST correct edit — do not rewrite a whole phase or a whole doc.
- Patch EXACTLY ONE file. If the fix seems to belong in two places, you mis-classified — re-check and pick the single correct one.
- When the edit is done, call ${SUBMIT_RETRO} EXACTLY ONCE with { scope, rootCause } (rootCause = one sentence). Do not call any tool after ${SUBMIT_RETRO}.`;
}

/** The convention message for a task-specific Retro commit — no human name (constitution). */
function buildRetroCommitMessage(task: Task, rootCause: string): string {
  const subject = `docs(task ${task.id}): clarify task after blocker`;
  const lines = [subject, '', rootCause.trim(), '', 'Retro-patched a task-specific gap surfaced by a resolved blocker.'];
  return lines.join('\n');
}

/**
 * Route the window's single edit to its authoritative fate BY RESOLVED PATH (never the model's claim):
 * a file under rules/phases/ is SYSTEMIC — never auto-committed, returned with a loud review warning; a
 * file under the project is TASK-SPECIFIC — committed via the V2/03 commit flow. A file under neither
 * (should be impossible given the root-scoped tools) is a hard error, committing nothing.
 */
function routeEdit(
  deps: RetroDeps,
  task: Task,
  editedAbs: string,
  submission: RetroSubmission,
  tokens: TokenCounts,
): RetroResult {
  if (isUnder(editedAbs, PHASES_DIR)) {
    const rel = `rules/phases/${path.basename(editedAbs)}`;
    return {
      scope: 'systemic',
      rootCause: submission.rootCause,
      editedFile: editedAbs,
      committed: false,
      reviewWarning:
        `A GLOBAL phase instruction file was patched: ${rel}. It is UNCOMMITTED. Review the change and ` +
        `commit it MANUALLY in the orchestrator repo before continuing — the orchestrator's own ` +
        `instruction set must never mutate silently (constitution).`,
      tokens,
    };
  }
  if (isUnder(editedAbs, deps.projectPath)) {
    const rel = path.relative(deps.projectPath, editedAbs);
    // commitPaths stages ONLY this path and refuses anything escaping the project repo (defense in depth
    // behind this path guard) — a rules edit could never ride along here even if mis-routed.
    const commit = commitPaths(deps.projectPath, buildRetroCommitMessage(task, submission.rootCause), [rel]);
    const result: RetroResult = {
      scope: 'task-specific',
      rootCause: submission.rootCause,
      editedFile: editedAbs,
      committed: commit.committed,
      tokens,
    };
    if (!commit.committed) {
      return { ...result, reviewWarning: `Retro edited ${rel} but the commit failed: ${commit.error ?? 'unknown error'}. Commit it manually.` };
    }
    return result;
  }
  throw new RetroError(`Retro edited a file outside both rules/phases and the project: ${editedAbs}`);
}

/**
 * Spawn a fresh Retro window, run it to completion (streaming to the REPL, all tool calls audited), and
 * route its single edit to a RetroResult. The window is discarded when this resolves. Throws RetroError
 * if the Retro produced no edit or never submitted a diagnosis (best-effort learning — the caller keeps
 * the session alive and the answer already recorded).
 */
export async function spawnRetro(deps: RetroDeps, input: RetroInput): Promise<RetroResult> {
  // Same pure resolve the window uses for its own defs, so the prompt's "# Your Tools" list names
  // read_phase_rule/edit_phase_rule/submit_retro exactly as the window sends them.
  const systemPrompt = buildSystemPrompt(
    loadPhasePrompt('retro'),
    resolvePhaseTools('retro'),
    `Project: ${deps.projectName}`,
  );
  const window = new RetroWindow(deps, systemPrompt);
  await processMessage(window, buildRetroSeed(input), RETRO_MAX_ROUNDS);

  const editedAbs = window.editedFile;
  const submission = window.submission;
  if (editedAbs === null) {
    throw new RetroError(`The Retro ended after ${RETRO_MAX_ROUNDS} rounds without patching any file.`);
  }
  if (submission === null) {
    throw new RetroError(`The Retro edited ${editedAbs} but ended without calling ${SUBMIT_RETRO}.`);
  }
  return routeEdit(deps, input.task, editedAbs, submission, window.tokens);
}
