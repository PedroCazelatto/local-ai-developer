// inbox_post (V3/04) — a global registry tool: post a concern from the ACTIVE phase to another phase's
// inbox, the durable cross-phase channel (each phase window has its own isolated history, so signals
// must go through the inbox). `from` is the active phase (ctx.phase — the model never names itself);
// `to` is validated against the closed six-phase set (case-insensitive → canonical PascalCase). A bad
// recipient or blank body is a STRUCTURED, recoverable error the model reads and retries, never a
// thrown/killed turn. Part of the AGENT_NOTES.md replacement (CLAUDE.md / ROADMAP V3); every call is
// audited like any tool.

import { canonicalizePhase, postToInbox } from '../core/session/inbox-store.js';
import { toolError } from './types.js';
import type { ToolModule, ToolResult } from './types.js';

export const inboxPostTool: ToolModule = {
  name: 'inbox_post',
  description:
    "Post a note to ANOTHER phase's inbox — the durable cross-phase channel (each phase window has its " +
    'own isolated history, so signals must go through the inbox). Use it when you spot a concern that ' +
    'belongs to a different phase (e.g. Design → Worker: an architecture constraint the task must honor). ' +
    '`to` must be one of Discovery, Design, Breakdown, Worker, Reviewer, Retro. Returns { ok: true, id }, ' +
    'or a structured error ("unknown_to_phase" / "empty_body") the turn recovers from.',
  parameters: {
    type: 'object',
    required: ['to', 'body'],
    properties: {
      to: {
        type: 'string',
        description: 'Recipient phase: Discovery | Design | Breakdown | Worker | Reviewer | Retro.',
      },
      body: {
        type: 'string',
        description: 'The concise concern — what the recipient needs to know and why it matters.',
      },
    },
  },

  async execute(ctx, args): Promise<ToolResult> {
    // canonicalizePhase: match the six-phase closed set case-insensitively → canonical PascalCase, else undefined.
    const to = canonicalizePhase(typeof args['to'] === 'string' ? args['to'] : '');
    if (to === undefined) {
      return {
        content: {
          ok: false,
          error: 'unknown_to_phase',
          message: "'to' must be one of Discovery, Design, Breakdown, Worker, Reviewer, Retro",
        },
      };
    }
    const body = typeof args['body'] === 'string' ? args['body'].trim() : '';
    if (body === '') {
      return { content: { ok: false, error: 'empty_body', message: "'body' must be a non-empty string" } };
    }
    const from = canonicalizePhase(ctx.phase);
    if (from === undefined) {
      // Can't happen with the six phases (ctx.phase is orchestrator-controlled); surface it, don't guess.
      return toolError(`internal: active phase '${ctx.phase}' is not a known phase`);
    }
    // postToInbox: assign the next project-global id, append a `post` event to the recipient's JSONL, return the item.
    const item = postToInbox(ctx.projectPath, from, to, body);
    return { content: { ok: true, id: item.id }, display: { summary: `posted ${item.id}` } };
  },
};
