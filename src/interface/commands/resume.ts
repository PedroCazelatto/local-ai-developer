// /resume — reopen one of the active phase's earlier contexts (mirrors /clear). Every figure in the
// listing is DERIVED from the stored turns by one query — no LLM call, no cost. The title is the
// exception: it was written once, by a throwaway one-shot, when the context produced its first prose
// answer. A user command, never a model tool, so it lives in interface/commands/.
//
// Two ways in: `/resume <address>` reopens directly, and a bare `/resume` lists the recent contexts and
// asks for a number. Both funnel through reopen-context.ts, so the two cannot drift apart.
//
// OLLAMA_NUM_CTX cuts across both. A context written under a LARGER ceiling is not listed and cannot be
// reopened — see memory-db.listContexts; it is hidden, never deleted, and restoring the old ceiling
// brings it back. A context written under a SMALLER one is reachable, because a history that fitted
// 8 192 fits 16 384, but it is not silently reachable: the listing MARKS it, so the mismatch is visible
// before the choice is made, and the restore warns on top of that, naming both ceilings. Either half
// alone leaves a hole — the marker cannot reach `/resume <address>`, and a warning after the fact
// arrives once the context is already open.
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// resume-context.ts drives both ways in, over render-context-list.ts, reopen-context.ts,
// warn-smaller-ceiling.ts and the label/predicate files beside them. The three private copies this
// file used to declare are gone: `write` (core/ui/write.ts), `titleCase`
// (core/ui/capitalize-phase.ts) and `localStamp`, which was format-local-stamp.ts already.

import type { Command } from '../command.type.js';
import { resumeContext } from './resume-context.js';

export const resumeCommand: Command = {
  name: 'resume',
  group: 'session',
  description: "Reopen one of the active phase's earlier contexts",
  usage: '/resume [<address>]',
  // resumeContext: reopens the address given, or lists the phase's recent contexts and reopens the
  // number the user picks — marking and then warning about anything written under a smaller num_ctx.
  run: (ctx) => resumeContext(ctx.orch, ctx.rl, ctx.args),
};
