// inbox_read (V3/04) — a global registry tool: return the ACTIVE phase's inbox items. The model never
// names itself; the recipient is derived from ctx.phase (the session's active phase), directly killing
// the drift the AGENT_NOTES.md `## To:` sections had. `status` = "open" (default, unresolved only) or
// "all" (full history incl. resolved). The result is a JSON array of InboxItems the model reads at
// phase start to address open signals before starting new work.

import { canonicalizePhase } from '../core/session/canonicalize-phase.js';
import { readInbox } from '../core/session/read-inbox.js';
import { toolError } from './types.js';
import type { ToolModule, ToolResult } from './types.js';

export const inboxReadTool: ToolModule = {
  name: 'inbox_read',
  description:
    'Read YOUR inbox — messages other phases posted to you (you never name yourself; the active phase ' +
    'is known). Call this at phase start and address every open item before starting new work. `status` ' +
    '"open" (default) returns only unresolved items; "all" returns the full history including resolved ' +
    'ones. Returns a JSON array of items ({ id, from, to, created, body, resolved, … }).',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter: "open" (default — unresolved only) or "all" (full history, incl. resolved).',
        default: 'open',
      },
    },
  },

  async execute(ctx, args): Promise<ToolResult> {
    const active = canonicalizePhase(ctx.phase);
    if (active === undefined) {
      // Can't happen with the six phases (ctx.phase is orchestrator-controlled); surface it, don't guess.
      return toolError(`internal: active phase '${ctx.phase}' is not a known phase`);
    }
    const status = args['status'] === 'all' ? 'all' : 'open';
    // readInbox: replay the active phase's own JSONL, fold posts + resolves, filter by status.
    const items = readInbox(ctx.projectPath, active, status);
    // A JSON array string is a plain success result — the model parses it (all tool results are strings).
    const label = status === 'open' ? 'open item' : 'item';
    return {
      content: JSON.stringify(items),
      display: { summary: items.length === 0 ? 'empty' : `${items.length} ${label}${items.length === 1 ? '' : 's'}` },
    };
  },
};
