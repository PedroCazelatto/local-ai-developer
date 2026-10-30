// ask_subagent (V5/01) — send a follow-up message to a sub-agent you previously spawned (by its id).
// The sub-agent keeps its OWN history across ask calls, so it remembers the file/context it was given
// and can build on its earlier answers. Returns { response }. An unknown or already-dismissed id
// returns a RECOVERABLE structured `unknown_subagent` error (flat shape, matching the rest of the
// tool set) so the model can read it and adjust — the turn is never killed.

import type { JsonObject } from './json-object.type.js';
import { toolError } from './tool-error.js';
import type { ToolModule } from './tool-module.type.js';
import type { ToolResult } from './tool-result.type.js';

export const ASK_SUBAGENT = 'ask_subagent';

export const askSubagentTool: ToolModule = {
  name: ASK_SUBAGENT,
  description:
    'Send a follow-up message to a sub-agent you previously spawned (by its id). It keeps its own ' +
    'history across calls, so it remembers the context/files it was given. Returns { response }. An ' +
    'unknown or dismissed id returns an unknown_subagent error you can recover from.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The id returned by spawn_subagent for the sub-agent to continue.',
      },
      message: {
        type: 'string',
        description: 'The next message for that sub-agent — it retains its earlier context.',
      },
    },
    required: ['id', 'message'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const handle = ctx.subagents;
    if (handle === undefined) {
      return toolError(
        'sub-agents are not available in this context.',
        'ask_subagent runs only from an interactive phase, not inside a spawned window or another sub-agent.',
      );
    }
    const id = args['id'];
    const message = args['message'];
    if (typeof id !== 'string' || id.trim() === '') {
      return toolError("'id' must be a non-empty string.", 'Pass the id spawn_subagent returned.');
    }
    if (typeof message !== 'string' || message.trim() === '') {
      return toolError("'message' must be a non-empty string.");
    }
    const outcome = await handle.ask(id.trim(), message);
    if (!outcome.found) {
      // Flat structured error, consistent with toolError / load_rule (`{ error: <string>, …extra }`).
      const content: JsonObject = {
        error: `No active sub-agent with id ${id.trim()}. It may have been dismissed or never existed.`,
        code: 'unknown_subagent',
      };
      return { content, exitStatus: -1, error: 'unknown_subagent' };
    }
    const content: JsonObject = { response: outcome.response };
    return { content, display: { summary: `${outcome.response.length} chars` } };
  },
};
