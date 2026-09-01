// The tool-dispatch turn loop (port of main.py's _run_turn / _process_message). One TURN =
// stream one assistant message, then dispatch any tool calls it issued. processMessage runs the
// first turn, then continues turn-after-turn until the model stops calling tools, bounded by
// MAX_TOOL_ROUNDS so a confused model can't spin forever.
//
// The loop drives the UI (renderer + spinner) and the orchestrator through the TurnContext seam
// (SessionOrchestrator implements it), so this file stays free of Ollama/sandbox details.

import { TurnAbortedError } from '../llm/index.js';
import { inputFence } from '../ui/input-fence.js';
import { renderer } from '../ui/renderer.js';
import { statusActivity } from '../ui/status-activity.js';
import { runTurn } from './run-turn.js';
import type { AbortedTurn } from './run-turn.js';
import type { TurnContext } from './turn-context.type.js';

/** Exact value ported from main.py — caps the implement/continue rounds per user message. */
export const MAX_TOOL_ROUNDS = 8;

/**
 * Run turns for one user message until the model stops calling tools (or the cap is hit). The cap
 * defaults to MAX_TOOL_ROUNDS for interactive phases; the Worker (V1/10) passes a larger value
 * since a test-first implement loop (write test → run → implement → run) needs more headroom.
 */
export async function processMessage(
  ctx: TurnContext,
  userInput: string,
  maxRounds: number = MAX_TOOL_ROUNDS,
): Promise<void> {
  // Mark a turn in flight so the status line (V5/03) can show the live thinking/elapsed field, and
  // always clear it — even if a stream throws mid-turn — so idle never shows a stuck "thinking".
  statusActivity.turnStarted();
  // inputFence.begin: pin the fenced `›` box above the status bar for the length of the turn and take
  // stdin, so typing mid-turn lands in that row instead of echoing into the reply. Reentrant — a
  // sub-agent's nested processMessage shares the one fence — and always released in the finally.
  inputFence.begin();
  // Whatever the model had produced when a turn was cut, carried out here so that EVERY way an exchange
  // can be aborted — mid-stream, or inside a tool call that is itself running a model (a sub-agent's
  // turn, search_rules' one-shot, a debate round) — rolls back through the one path below. Two rollback
  // sites would be two things to keep in step; there is one.
  const cut: AbortedTurn = { message: { role: 'assistant', content: '' } };
  try {
    if (!(await runTurn(ctx, () => ctx.streamAsk(userInput), cut))) {
      return; // no tool calls on the first turn → done
    }
    for (let round = 0; round < maxRounds; round++) {
      if (!(await runTurn(ctx, () => ctx.streamContinue(), cut))) {
        return; // model finished
      }
    }
    renderer.systemMessage(`⚠ Reached tool-call limit (${maxRounds}). Stopping.`);
  } catch (err) {
    // The interactive phases branch the whole exchange off their live history here; spawned windows
    // leave the hook absent and simply unwind. Anything that is not an abort passes straight through.
    if (err instanceof TurnAbortedError) ctx.onAborted?.(err.reason, cut.message);
    throw err;
  } finally {
    statusActivity.turnEnded();
    inputFence.end();
  }
}
