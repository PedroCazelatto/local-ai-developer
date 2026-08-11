// inbox_resolve (V3/04) — a global registry tool: close an inbox item with a one-line note. It locates
// the recipient file that holds `id` (an item lives in the file named after its `to` phase) and appends
// a `resolve` event there; the resolver (ctx.phase) is recorded distinctly from the original recipient,
// so ANY phase may resolve an item it did not receive. Unknown or already-resolved ids are STRUCTURED,
// recoverable errors — never a thrown/killed turn. Part of the AGENT_NOTES.md replacement (ROADMAP V3).

import { canonicalizePhase, resolveInboxItem } from '../core/session/inbox-store.js';
import { toolError } from './types.js';
import type { ToolModule, ToolResult } from './types.js';

export const inboxResolveTool: ToolModule = {
  name: 'inbox_resolve',
  description:
    'Resolve (close) an inbox item by id with a short note on how it was addressed. Get the id from ' +
    'inbox_read. Returns { ok: true, id } on success, or a structured error ("unknown_id" / ' +
    '"already_resolved") the turn recovers from.',
  parameters: {
    type: 'object',
    required: ['id', 'note'],
    properties: {
      id: { type: 'string', description: 'The inbox item id to resolve (from inbox_read).' },
      note: {
        type: 'string',
        description: 'One line on how it was addressed (e.g. "Done in commit abc123.").',
      },
    },
  },

  async execute(ctx, args): Promise<ToolResult> {
    if (typeof args['id'] !== 'string' || args['id'].trim() === '') {
      return { content: { ok: false, error: 'unknown_id', message: "'id' must be a non-empty string" } };
    }
    if (typeof args['note'] !== 'string' || args['note'].trim() === '') {
      return toolError("'note' must be a non-empty string");
    }
    const resolver = canonicalizePhase(ctx.phase);
    if (resolver === undefined) {
      // Can't happen with the six phases (ctx.phase is orchestrator-controlled); surface it, don't guess.
      return toolError(`internal: active phase '${ctx.phase}' is not a known phase`);
    }
    // resolveInboxItem: scan recipient files for `id`, reject unknown/already-resolved, else append a resolve event.
    const result = resolveInboxItem(ctx.projectPath, resolver, args['id'].trim(), args['note'].trim());
    if (result.ok) {
      return { content: { ok: true, id: result.id }, display: { summary: `resolved ${result.id}` } };
    }
    return { content: { ok: false, error: result.error, message: result.message } };
  },
};
