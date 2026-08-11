// dismiss_subagent (V5/01) — drop a sub-agent you no longer need, freeing its in-memory context.
// IDEMPOTENT: dismissing an unknown or already-dismissed id still returns { ok: true } with no error,
// so the model never has to reason about whether it already cleaned one up. Any sub-agent not
// explicitly dismissed is dropped at session end anyway (in-memory only — no persistence).

import type { JsonObject, ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

export const DISMISS_SUBAGENT = 'dismiss_subagent';

export const dismissSubagentTool: ToolModule = {
  name: DISMISS_SUBAGENT,
  description:
    'Drop a sub-agent you no longer need, freeing its in-memory context. Idempotent: dismissing an ' +
    'unknown or already-dismissed id still returns { ok: true }. Any sub-agent you do not dismiss is ' +
    'dropped when the session ends.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The id of the sub-agent to dismiss.',
      },
    },
    required: ['id'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const handle = ctx.subagents;
    if (handle === undefined) {
      return toolError(
        'sub-agents are not available in this context.',
        'dismiss_subagent runs only from an interactive phase, not inside a spawned window or another sub-agent.',
      );
    }
    const id = args['id'];
    if (typeof id !== 'string' || id.trim() === '') {
      return toolError("'id' must be a non-empty string.");
    }
    const { ok } = handle.dismiss(id.trim()); // always { ok: true } — idempotent by contract
    const content: JsonObject = { ok };
    return { content, display: { summary: 'dismissed' } };
  },
};
