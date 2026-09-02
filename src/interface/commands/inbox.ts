// /inbox [<phase>|all] — the open items sitting in a phase's cross-phase inbox. Bare, it is the
// ACTIVE phase's; a phase name is that one phase's; `all` is every phase's.
//
// The inbox is otherwise a channel only the model can see, which makes it impossible to tell from
// outside whether the protocol is being followed at all — whether a phase actually reads its inbox at
// phase start and posts a concern when it spots one. This is the window onto that.
//
// A pure read of the same JSONL files the model's inbox_read tool folds, and deliberately NOT a way
// to write: a phase that needs its own inbox has `inbox_read`, posting belongs to `inbox_post`, and
// closing an item is `inbox_resolve` — a one-line note by whoever actually dealt with it. There is no
// user-side resolve here, because a user closing an item the model never saw would be a lie in the
// record (docs/phases.md).
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// show-inbox.ts resolves the selector and prints, over write-phase-block.ts for one phase's block.
// The phase-order list and its compile-time exhaustiveness guard moved with show-inbox.ts, which is
// the only reader either has.

import type { Command } from '../command.type.js';
import { showInbox } from './show-inbox.js';

export const inboxCommand: Command = {
  name: 'inbox',
  group: 'session',
  description: "Show the open cross-phase inbox items — the active phase's, one phase's, or every phase's",
  usage: '/inbox [<phase> | all]',
  // showInbox: the open items for the phase named (or the active one), or every phase in lifecycle
  // order for `all`, with an unknown name answered by the list of six.
  run: (ctx) => showInbox(ctx.args, ctx.orch),
};
