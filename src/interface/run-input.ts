// One line of input, whichever kind it is — and the boundary that keeps a bad turn from killing the
// session. Every queued message goes through here too, so the swallow applies to all of them equally.

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import { errMessage } from '../core/err-message.js'; // an Error's message, or the thrown value stringified
import { TurnAbortedError } from '../core/llm/index.js';
import { activityLine } from '../core/ui/activity-line.js';
import { renderer } from '../core/ui/renderer.js';
import { handleCommand } from './handle-command.js'; // registry dispatch; true only when /exit ran
import type { ReplOrchestrator } from './run-repl.js';

/**
 * Run ONE line of input — a `/command` or a chat message — returning true only when it asked to exit.
 *
 * Any error is SHOWN and swallowed here rather than at the loop: one bad turn (a dropped Ollama stream,
 * a tool blowup) must never kill the session, and must not strand the messages queued behind it either.
 * Only genuinely fatal errors that escape to `main().catch` (boot failures, Node runtime faults) end
 * the app, printing to the console.
 */
export async function runInput(orch: ReplOrchestrator, input: string, rl: ReadlineInterface): Promise<boolean> {
  try {
    if (input.startsWith('/')) return await handleCommand(orch, input, rl);
    await orch.processMessage(input);
  } catch (err) {
    activityLine.hide(); // the activity line may still be up if the turn threw mid-stream
    // A cancelled turn is not a failure and must not be dressed as one: the user asked for it, the
    // exchange has already been branched off the history by the orchestrator, and the prompt below is
    // about to reopen ready for a rewrite. A TIMEOUT is a fault, so it keeps the error styling — its
    // message already says what to check.
    if (err instanceof TurnAbortedError && err.reason === 'user') {
      renderer.systemMessage('⎋ Turn cancelled. The message and its partial reply were set aside.');
    } else {
      renderer.errorLine(`✖ ${errMessage(err)}`);
    }
  }
  return false;
}
