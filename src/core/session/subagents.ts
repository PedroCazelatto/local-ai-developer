// SubagentManager (V5/01) — the orchestrator-owned registry of live sub-agents. Each sub-agent is a
// fresh, ISOLATED messages array against the same local Ollama (CLAUDE.md "core mental model"),
// spawned by the model mid-turn with hand-picked context. The manager holds them in memory only (they
// die with the session — no JSONL), runs their bounded tool-dispatch loop NON-STREAMING (only the
// `[sub:<short>]` tool-call marker is printed — the master receives the answer as its tool result),
// accumulates EXACT per-sub-agent token totals, and audits every sub-agent tool call with its
// subagent_id so lineage is traceable.
//
// Isolation is the whole point: a sub-agent's messages are seeded ONLY with initial_context + task,
// never the master's history; and the master's history is never polluted by the sub-agent's internal
// turns — the master only ever sees the { id, response } tool result.

import { resolvePhaseTools } from '../../phases/index.js';
import { ASK_SUBAGENT } from '../../tools/ask-subagent.js';
import { DISMISS_SUBAGENT } from '../../tools/dismiss-subagent.js';
import { createToolContext } from '../../tools/create-tool-context.js';
import { SPAWN_SUBAGENT } from '../../tools/spawn-subagent.js';
import type { SandboxClient } from '../container/index.js';
import type { Message, OllamaClient, TokenCounts, Tool } from '../llm/index.js';
import { printToolCall } from '../ui/print-tool-call.js';
import { addTokenCounts } from './add-token-counts.js';
import { dispatchToolCall } from './dispatch-tool-call.js';
import { appendEvent } from './events-log.js';
import { generateSubagentId } from './generate-subagent-id.js';
import { createReadTracker } from './read-tracker.js';
import type { FileReadTracker } from './file-read-tracker.type.js';
import { recordToolCall } from './record-tool-call.js';
import { shortSubagentId } from './short-subagent-id.js';
import type { SubagentAskOutcome } from './subagent-ask-outcome.type.js';
import type { SubagentHandle } from './subagent-handle.type.js';
import type { SubagentInfo } from './subagent-info.type.js';
import type { SubagentSpawnResult } from './subagent-spawn-result.type.js';

/**
 * One live sub-agent's in-memory state (dies with the session — no JSONL, unlike per-phase memory).
 * `promptTokens`/`evalTokens` are the EXACT cumulative Ollama counts across all of this sub-agent's
 * turns (a `null` on any turn poisons the running sum — constitution: never a length-based estimate).
 */
export interface SubagentState {
  readonly id: string;
  /**
   * The live session model at spawn — a reference record only. A sub-agent's turns dispatch through the
   * shared client, so it uses the session's CURRENT live model, not a pin (V5/02: every window shares the
   * one model; it only changes between turns, never mid-work).
   */
  readonly model: string;
  readonly numCtx: number;
  /** Its OWN isolated history: the system brief + the task + every turn since. Never the master's history. */
  readonly messages: Message[];
  /**
   * The MASTER PHASE's own allowlist minus the three sub-agent tools — never the full registry, so a
   * sub-agent can never reach a tool its master is gated out of. No nested sub-agents, verified by
   * construction. Resolved at spawn from the master phase (SubagentManager.toolsForMaster).
   */
  readonly toolDefs: Tool[];
  /** The phase that spawned it — stamped as `phase` on every audit row for this sub-agent's tool calls. */
  readonly masterPhase: string;
  /**
   * Its OWN read tracker, isolated exactly like `messages`. A sub-agent's reads must never satisfy its
   * master's look-before-you-write guard: the master never saw what the sub-agent read, and a brief
   * summarising a file is not the file — which is precisely the case the guard exists to catch. The
   * isolation runs the other way too: the master's reads do not unlock writes here.
   */
  readonly readTracker: FileReadTracker;
  /** Date.now() ms at spawn — drives the age shown by `/subagents`. */
  readonly createdAt: number;
  /** EXACT cumulative prompt_eval_count; null once any turn failed to report it (never estimated). */
  promptTokens: number | null;
  /** EXACT cumulative eval_count; null once any turn failed to report it. */
  evalTokens: number | null;
}

/** Everything the SubagentManager needs to run + audit sub-agent turns against the session's one model. */
export interface SubagentDeps {
  readonly llm: OllamaClient;
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
  /** num_ctx recorded on each SubagentState. The model is read LIVE from `llm` at spawn (V5/02). */
  readonly numCtx: number;
}

/** The three tools a sub-agent must NOT receive — stripped from its tool defs so it cannot nest. */
export const SUBAGENT_TOOL_NAMES: readonly string[] = [SPAWN_SUBAGENT, ASK_SUBAGENT, DISMISS_SUBAGENT];

// The short-id length lives in its own file so spawn_subagent can name the sub-agent that answered
// without importing this module (which imports the tool). Re-exported here because that is where
// `/subagents` and core/session/index.ts have always read it from.
export { SUBAGENT_SHORT_ID_LEN } from './short-subagent-id.js';

// A sub-agent may read a couple of files before answering; give it headroom before the loop cap trips,
// but far less than the Worker's implement loop (a sub-agent is a focused side-task, not a full build).
const SUBAGENT_MAX_ROUNDS = 12;

export class SubagentManager implements SubagentHandle {
  private readonly agents = new Map<string, SubagentState>();

  constructor(private readonly deps: SubagentDeps) {}

  /**
   * The tool defs for a sub-agent of `masterPhase`: that phase's OWN allowlist minus the three
   * sub-agent tools. Resolved per spawn, not once in the constructor — the master phase changes with
   * /swap, and this tool set is the master's, so a single set computed at construction would be the
   * wrong one for every phase but the first.
   *
   * Inheriting the MASTER'S array (not the full registry) is what makes the phase gate hold: a
   * sub-agent that got the whole registry would be a way to reach tools its master cannot call —
   * Discovery has no shell, so its sub-agent must not have one either. `registryOnly` because a
   * sub-agent dispatches through the shared registry-backed dispatcher, which cannot serve a
   * phase-scoped tool (it would answer "unknown tool").
   */
  private toolsForMaster(masterPhase: string): Tool[] {
    // resolvePhaseTools: the phase's names from phase-tool-names.ts turned into Tool definitions,
    // throwing a typed PhaseToolsError on an unknown phase or an unknown tool name.
    return resolvePhaseTools(masterPhase, { registryOnly: true }).filter(
      // No nesting, verified by construction: absent definitions mean it cannot call them at all
      // (defense beyond ctx.subagents being undefined in a sub-agent's own dispatch).
      (tool) => !SUBAGENT_TOOL_NAMES.includes(tool.function.name ?? ''),
    );
  }

  get count(): number {
    return this.agents.size;
  }

  async spawn(masterPhase: string, initialContext: string, task: string): Promise<SubagentSpawnResult> {
    const id = generateSubagentId();
    const state: SubagentState = {
      id,
      // The live session model AT SPAWN (V5/02). Recorded for reference only — its turns dispatch through
      // the shared client, so it follows the session's current live model like every other window (the
      // model only ever changes between turns). Same at spawn since a switch can't happen mid-work.
      // requireModel, not model: a spawn only ever happens inside a master turn, which cannot have started
      // without a model — so this can't throw in practice, and typing it `string | undefined` would be a
      // lie the whole SubagentState surface then has to carry.
      model: this.deps.llm.requireModel(),
      numCtx: this.deps.numCtx,
      // Seeded ONLY with the master's brief + task — never the master's history (isolation).
      messages: [{ role: 'system', content: initialContext }],
      toolDefs: this.toolsForMaster(masterPhase),
      masterPhase,
      // createReadTracker: this sub-agent's own record of what IT has read — isolated from the master's
      // the same way `messages` is, so neither one's reads unlock the other's writes.
      readTracker: createReadTracker(),
      createdAt: Date.now(),
      promptTokens: 0,
      evalTokens: 0,
    };
    this.agents.set(id, state);
    const response = await this.runTurns(state, task);
    // V5/04 subagent_spawn: log the new sub-agent with its initial EXACT token figures (omitted when a
    // turn didn't report them — never estimated). `phase` is the master phase (the spawner), `subagentId`
    // its lineage — so detail carries nothing extra.
    appendEvent(this.deps.projectPath, {
      type: 'subagent_spawn',
      phase: masterPhase,
      subagentId: id,
      detail: {},
      ...(state.promptTokens !== null ? { promptTokens: state.promptTokens } : {}),
      ...(state.evalTokens !== null ? { evalTokens: state.evalTokens } : {}),
    });
    return { id, response };
  }

  async ask(id: string, message: string): Promise<SubagentAskOutcome> {
    const state = this.agents.get(id);
    if (state === undefined) {
      return { found: false }; // unknown/dismissed — the tool turns this into the recoverable error
    }
    const response = await this.runTurns(state, message);
    return { found: true, response };
  }

  dismiss(id: string): { readonly ok: boolean } {
    // Log a V5/04 subagent_dismiss only for an id that actually existed (its master phase is on the
    // state) — an idempotent no-op dismiss of an unknown id isn't a structural event worth a row.
    const state = this.agents.get(id);
    if (state !== undefined) {
      this.agents.delete(id);
      appendEvent(this.deps.projectPath, {
        type: 'subagent_dismiss',
        phase: state.masterPhase,
        subagentId: id,
        detail: {},
      });
    }
    return { ok: true }; // still idempotent — an unknown/already-dismissed id returns ok
  }

  list(): SubagentInfo[] {
    return [...this.agents.values()].map((s) => ({
      id: s.id,
      shortId: shortSubagentId(s.id),
      createdAt: s.createdAt,
      messageCount: s.messages.length,
      promptTokens: s.promptTokens,
      evalTokens: s.evalTokens,
    }));
  }

  /**
   * Run ONE message against a sub-agent to its next answer: append the user message, then loop
   * NON-STREAMING (chat, not stream) — each turn either issues tool calls (dispatch them, print the
   * `[sub:<short>]` marker, feed results back) or produces final prose, which is the returned response.
   * Bounded by SUBAGENT_MAX_ROUNDS so a confused sub-agent can't spin forever.
   */
  private async runTurns(state: SubagentState, userMessage: string): Promise<string> {
    state.messages.push({ role: 'user', content: userMessage });
    const short = shortSubagentId(state.id);

    for (let round = 0; round <= SUBAGENT_MAX_ROUNDS; round += 1) {
      // 'subagent' is a WINDOW role — it holds tools and a history — so it sits at the base ceiling
      // alongside its master, which is what `state.numCtx` records.
      const { message, tokens } = await this.deps.llm.chat('subagent', state.messages, state.toolDefs);
      this.accumulate(state, tokens);

      const toolCalls = message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        state.messages.push({ role: 'assistant', content: message.content });
        return message.content; // final prose — handed back to the master as the tool result
      }

      // qwen2.5-coder renders assistant content XOR tool_calls, so store empty content to keep the
      // tool call on replay (same rule as the shared turn loop and the Worker/Reviewer windows).
      state.messages.push({ role: 'assistant', content: '', tool_calls: toolCalls });
      for (const call of toolCalls) {
        const name = call.function.name;
        // printToolCall with the short id: same `→ <tool> <subject>` record every phase gets, indented
        // one step and marked `[sub:…]`, so a sub-agent's twenty calls read as somebody else's work
        // rather than burying the parent call they happened inside. It prints through interjectLine —
        // a sub-agent's turns run INSIDE the master's spawn/ask call, so the master's transient
        // activity line owns the cursor row the whole time, and writing straight to it would weld the
        // spinner frame into the append-only scrollback.
        printToolCall(name, call.function.arguments, short);
        const result = await this.dispatch(state, name, call.function.arguments);
        state.messages.push({ role: 'tool', content: result, tool_name: name });
      }
    }

    // Round cap reached without a plain-prose answer — surface it, never fabricate one (constitution).
    return `[sub-agent ${short} reached its ${SUBAGENT_MAX_ROUNDS}-round limit without a final answer]`;
  }

  /**
   * Dispatch one sub-agent tool call through the SAME registry-backed dispatcher every phase uses
   * (same sandbox scoping, same recoverable-error contract). The ctx has NO `subagents` handle and the
   * sub-agent's tool defs exclude the three sub-agent tools, so it cannot spawn. `phase` is the master
   * phase; the audit row gets an extra `subagent_id` so the call traces back to this sub-agent.
   */
  private dispatch(state: SubagentState, name: string, args: unknown): Promise<string> {
    const ctx = createToolContext({
      projectName: this.deps.projectName,
      projectPath: this.deps.projectPath,
      sandbox: this.deps.sandbox,
      phase: state.masterPhase,
      llm: this.deps.llm, // required by createToolContext; backs ctx.oneShot for search_rules
      readTracker: state.readTracker, // THIS sub-agent's own — never the master's (see SubagentState)
    });
    // recordToolCall: the audit row (with this sub-agent's id for lineage) AND the `←` result line,
    // indented and marked like the `→` line above it.
    const short = shortSubagentId(state.id);
    return dispatchToolCall(ctx, name, args, {
      onToolCall: (record) => recordToolCall(this.deps.projectPath, { ...record, subagentId: state.id }, short),
    });
  }

  /** Fold this turn's EXACT counts into the sub-agent's running total (a null poisons the sum). */
  private accumulate(state: SubagentState, tokens: TokenCounts): void {
    const summed = addTokenCounts({ promptTokens: state.promptTokens, evalTokens: state.evalTokens }, tokens);
    state.promptTokens = summed.promptTokens;
    state.evalTokens = summed.evalTokens;
  }
}
