// A single Retro window implementing the turn loop's TurnContext against its OWN messages array --
// isolated from the session's per-phase histories and from the Worker and Reviewer.
//
// TWO EDIT ROOTS, two dispatch paths. Project read/edit tools go through the shared registry, audited
// as phase "retro"; the rules-scoped read_phase_rule / edit_phase_rule and submit_retro are answered
// here directly, because the registry tools cannot reach rules/.
//
// THE ONE-FILE LOCK SPANS BOTH ROOTS. The window locks onto the first file it SUCCESSFULLY edits, and a
// later edit to a DIFFERENT file is refused with a recoverable message telling the model to
// re-classify. Two files means a mis-classification, and the orchestrator enforces that itself rather
// than trusting the model to.

import path from 'node:path';
import type { Message, Tool, ToolCall } from 'ollama';

import { PHASE_SCOPED_TOOL_NAMES, RETRO_TOOL_NAMES } from '../../phases/phase-tool-names.js';
import { resolvePhaseTools } from '../../phases/resolve-phase-tools.js';
import { buildFileDiff } from '../../tools/build-file-diff.js';
import { applyPhaseRuleEdit, EDIT_PHASE_RULE } from '../../tools/edit-phase-rule.js';
import { createToolContext } from '../../tools/create-tool-context.js';
import { resolveInProject } from '../../tools/resolve-in-project.js';
import { toolError } from '../../tools/tool-error.js';
import { READ_PHASE_RULE, readPhaseRule } from '../../tools/read-phase-rule.js';
import { parseRetroSubmission, SUBMIT_RETRO } from '../../tools/submit-retro.js';
import type { StreamHandle } from '../llm/client.js';
import type { TokenCounts } from '../llm/token-counts.type.js';
import type { ToolCallDisplay } from '../ui/tool-call-display.type.js';
import { addTokenCounts } from './add-token-counts.js';
import { candidatePhaseFile } from './candidate-phase-file.js';
import type { ToolCallRecord } from './tool-call-record.type.js';
import { dispatchToolCall } from './dispatch-tool-call.js';
import { isToolErrorResult } from './is-tool-error-result.js';
import { createReadTracker } from './read-tracker.js';
import type { FileReadTracker } from './file-read-tracker.type.js';
import { recordToolCall } from './record-tool-call.js';
import type { RetroDeps } from './retro-deps.type.js';
import type { RetroSubmission } from './retro-submission.type.js';
import type { TurnContext } from './turn-context.type.js';

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

/**
 * A single Retro window implementing the turn loop's TurnContext against its OWN messages array —
 * isolated from the session's per-phase histories and from the Worker/Reviewer. Project read/edit tools
 * dispatch through the shared registry (audited as phase "retro"); the rules-scoped read/edit and
 * submit_retro are handled here directly. The one-file lock spans BOTH edit roots.
 */
export class RetroWindow implements TurnContext {
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
    return this.deps.llm.stream('retro', this.messages, this.retroTools);
  }

  streamContinue(): StreamHandle {
    return this.deps.llm.stream('retro', this.messages, this.retroTools);
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
