// spawn_subagent (V5/01) — spawn a fresh sub-agent: an isolated worker with its OWN empty context
// that the master phase briefs and hands ONE task. The sub-agent never sees the master's history —
// only `initial_context` (its system brief) and `task` (its first user message). It runs to an answer
// against the same local Ollama and returns { id, response } in ONE round-trip (the common case is
// "fire one question, get one answer"). Follow up with ask_subagent(id, …); free it with
// dismiss_subagent(id). The sub-agent gets every tool the master has EXCEPT the three sub-agent tools,
// so it cannot spawn its own sub-agents (no nesting).

import type { JsonObject, ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

export const SPAWN_SUBAGENT = 'spawn_subagent';

export const spawnSubagentTool: ToolModule = {
  name: SPAWN_SUBAGENT,
  description:
    'Spawn a fresh sub-agent: an isolated worker with its own empty context that you brief and hand ONE ' +
    'task. It never sees your conversation — only initial_context (its system brief: role, constraints, ' +
    'what to focus on) and the task. It runs to an answer and returns { id, response } in one call. Use it ' +
    'for a side-task or a second opinion you do not want cluttering your own context. Follow up with ' +
    'ask_subagent(id, message); free it with dismiss_subagent(id). A sub-agent cannot spawn its own sub-agents.',
  parameters: {
    type: 'object',
    properties: {
      initial_context: {
        type: 'string',
        description:
          "The sub-agent's system brief: who it is, its constraints, and exactly what to focus on. This " +
          'is all the context it starts with — it cannot see your history.',
      },
      task: {
        type: 'string',
        description: 'The first user message: the concrete task or question to work on, with any content it needs inline.',
      },
    },
    required: ['initial_context', 'task'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    // ctx.subagents is present only for the interactive master phases (the orchestrator wires it); a
    // spawned window / a sub-agent has no manager, so this tool degrades to a recoverable error there.
    const handle = ctx.subagents;
    if (handle === undefined) {
      return toolError(
        'sub-agents are not available in this context.',
        'spawn_subagent runs only from an interactive phase, not inside a spawned window or another sub-agent.',
      );
    }
    const initialContext = args['initial_context'];
    const task = args['task'];
    if (typeof initialContext !== 'string' || initialContext.trim() === '') {
      return toolError("'initial_context' must be a non-empty string.", 'Brief the sub-agent: its role, constraints, and focus.');
    }
    if (typeof task !== 'string' || task.trim() === '') {
      return toolError("'task' must be a non-empty string.", 'Give the sub-agent one concrete task or question.');
    }
    // handle.spawn seeds a fresh window (initial_context as system, task as first user), runs it to an
    // answer, and returns the new id + that first response. ctx.phase is stamped on its audit rows.
    const { id, response } = await handle.spawn(ctx.phase, initialContext, task);
    const content: JsonObject = { id, response };
    return { content };
  },
};
