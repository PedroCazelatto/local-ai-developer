// /answer <task-id> <text> (V3/02 + V3/03) — the user resolves a blocker the Reviewer raised. It
// records the answer as a durable `resolved` row (blockers.jsonl), re-queues the task (blocked →
// pending) so the NEXT /run retries it with a fresh Worker, and then spawns the one-shot Retro window
// (V3/03) to diagnose the misunderstanding and patch the offending file so it can't recur. It
// deliberately does NOT restart the loop: /run is synchronous, so the user only reaches this prompt
// while the loop is stopped; they answer every blocker, then run /run again themselves.
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// dispatch-answer.ts does the work and complete-answer.ts offers the Tab candidates, over
// core/err-message.ts (the private `messageOf` copy this file used to declare is gone).

import type { Command } from '../command.type.js';
import { completeAnswer } from './complete-answer.js';
import { dispatchAnswer } from './dispatch-answer.js';

export const answerCommand: Command = {
  name: 'answer',
  group: 'execution',
  description: 'Resolve a Reviewer blocker; re-queues the task and spawns Retro to patch the gap',
  usage: '/answer <task-id> <answer text>',
  // completeAnswer: only the tasks sitting at `blocked` — the exact set this command can act on. It is
  // registered by NAME rather than wrapped in an arrow: the `run:` arrow below is already this file's
  // one declaration, and a second arrow here would be a second one.
  complete: completeAnswer,
  // dispatchAnswer: records the answer, re-queues the task, then spawns Retro (best-effort).
  // ctx.raw is the line minus its leading slash; re-add it so dispatchAnswer's own `/answer` strip and
  // the answer text's internal spacing are preserved (the whitespace-split ctx.args would collapse it).
  run: (ctx) => dispatchAnswer(`/${ctx.raw}`, ctx.orch),
};
