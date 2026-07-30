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

import { ASK_SUBAGENT } from '../../tools/ask-subagent.js';
import { DISMISS_SUBAGENT } from '../../tools/dismiss-subagent.js';
import { SPAWN_SUBAGENT } from '../../tools/spawn-subagent.js';
import { createToolContext } from '../../tools/index.js';
import { resolvePhaseTools } from '../../phases/index.js';
import type { Message, TokenCounts, Tool } from '../llm/index.js';
import * as renderer from '../ui/renderer.js';
import { addTokenCounts } from './add-token-counts.js';
import { appendAuditRow } from './audit.js';
import { dispatchToolCall } from './dispatch.js';
import { appendEvent } from './events-log.js';
import { generateSubagentId } from './generate-subagent-id.js';
import type {
  SubagentAskOutcome,
  SubagentDeps,
  SubagentHandle,
  SubagentInfo,
  SubagentSpawnResult,
  SubagentState,
} from './subagents.type.js';

/** The three tools a sub-agent must NOT receive — stripped from its tool defs so it cannot nest. */
export const SUBAGENT_TOOL_NAMES: readonly string[] = [SPAWN_SUBAGENT, ASK_SUBAGENT, DISMISS_SUBAGENT];

/** How many chars of the id the `[sub:<short>]` marker + `/subagents` list show. */
export const SUBAGENT_SHORT_ID_LEN = 4;

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
      shortId: s.id.slice(0, SUBAGENT_SHORT_ID_LEN),
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
    const short = state.id.slice(0, SUBAGENT_SHORT_ID_LEN);

    for (let round = 0; round <= SUBAGENT_MAX_ROUNDS; round += 1) {
      const { message, tokens } = await this.deps.llm.chat(state.messages, state.toolDefs);
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
        renderer.systemMessage(`→ tool: ${name} [sub:${short}]`);
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
    });
    return dispatchToolCall(ctx, name, args, {
      onToolCall: (record) => appendAuditRow(this.deps.projectPath, { ...record, subagentId: state.id }),
    });
  }

  /** Fold this turn's EXACT counts into the sub-agent's running total (a null poisons the sum). */
  private accumulate(state: SubagentState, tokens: TokenCounts): void {
    const summed = addTokenCounts({ promptTokens: state.promptTokens, evalTokens: state.evalTokens }, tokens);
    state.promptTokens = summed.promptTokens;
    state.evalTokens = summed.evalTokens;
  }
}
