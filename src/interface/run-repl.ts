// The persistent REPL loop: read a line, dispatch a `/command` through the registry (V5/03: EVERY
// command is registry-backed now — no fallback switch) or run it as a chat message, and keep the
// pinned bottom rows (rule + two status lines) fresh. Streaming output + the activity line are driven
// by the orchestrator's turn loop; this loop reads input, renders the shell around it, and paints status.
//
// It also owns the Tab key: completion CYCLES the word under the cursor through its candidates in
// place (cycle-completion.ts), which is the one shape that fits this terminal — it prints nothing, so
// there is no candidate list to reconcile with the pinned rows or with the append-only scrollback.
//
// Scrollback is preserved: a plain readline interface writes to the normal buffer (no alt-screen). The
// one-time clearScreen() at boot wipes launcher noise; the status bar reserves the bottom rows (see
// status-bar.ts) but the conversation and input stay in the scrolling area, copyable as ever.
//
// The loop is all that is left here. Every step it takes is its own file — is-completion-key.ts,
// complete-at-cursor.ts, request-cancel.ts, handle-stop-line.ts, update-status.ts, run-input.ts — and
// ReplOrchestrator stays with the function that takes it, which is this one.

import { createInterface } from 'node:readline/promises';
import type { Key } from 'node:readline';
import { stdin, stdout } from 'node:process';

import type { ClearResult } from '../core/session/clear-result.type.js';
import type { ContextSummary } from '../core/session/context-summary.type.js';
import type { RetroInput } from '../core/session/retro-input.type.js';
import type { RetroResult } from '../core/session/retro-result.type.js';
import type { RunStopSignal } from '../core/session/run-stop-signal.js';
import type { TaskLoopResult } from '../core/session/run-task-loop.js';
import type { SubagentInfo } from '../core/session/subagent-info.type.js';
import type { TaskLoopReporter } from '../core/session/task-loop-reporter.type.js';
import type { Task } from '../core/session/task.type.js';
import { activityLine } from '../core/ui/activity-line.js';
import { bindNewlineKey } from '../core/ui/bind-newline-key.js';
import { inputFence } from '../core/ui/input-fence.js';
import { INPUT_PROMPT } from '../core/ui/input-prompt.js';
import { messageQueue } from '../core/ui/message-queue.js';
import { renderer } from '../core/ui/renderer.js';
import { statusActivity } from '../core/ui/status-activity.js';
import { statusBar } from '../core/ui/status-bar.js';
import { completeAtCursor } from './complete-at-cursor.js'; // one Tab press: swap in the next candidate, return the cycle
import type { CompletionCycle } from './completion-cycle.type.js';
import { handleStopLine } from './handle-stop-line.js'; // claims /stop and /stop round typed into the fence mid-run
import { isCompletionKey } from './is-completion-key.js'; // a plain forward Tab, and nothing else
import { requestCancel } from './request-cancel.js'; // Ctrl+C mid-turn: stop the model call, say so in the scrollback
import { runInput } from './run-input.js'; // one line of input; shows and swallows any error it raises
import { updateStatus } from './update-status.js'; // recompute the two pinned status lines and paint them

/** How often (ms) the status + activity line repaint while a turn runs, to tick the elapsed timer. */
const STATUS_TICK_MS = 100;

/**
 * What the REPL needs from the orchestrator (the SessionOrchestrator satisfies this structurally).
 * Kept as an interface so this loop builds and reasons independently of the orchestrator internals.
 */
export interface ReplOrchestrator {
  readonly project: string;
  /**
   * Live session model (V5/02) — the status line reads it; /models use changes it via useModel.
   * undefined when no model is selected (nothing installed and the boot download declined).
   */
  readonly model: string | undefined;
  readonly numCtx: number;
  /** Current phase name — drives the status line. */
  readonly activePhase: string;
  /** /models use (V5/02): switch the live session model; the next turn + new windows/sub-agents use it. */
  useModel(name: string): void;
  /** Host path to projects/<active> — the /run command reads the backlog from here. */
  readonly projectPath: string;
  /** EXACT combined tokens from the last turn, or null if Ollama didn't report them. */
  readonly lastTurnTokenTotal: number | null;
  /** EXACT cumulative token total for the ACTIVE phase (V5/04) — 0 before its first turn, null if incomplete. */
  readonly activePhaseTokenTotal: number | null;
  /** Count of live sub-agents (V5/01) — the status line shows `Subagents: N` while any are active. */
  readonly subagentCount: number;
  /** /subagents (V5/01): a snapshot of every live sub-agent (id, age, message count, exact tokens). */
  listSubagents(): SubagentInfo[];
  /** Run the full turn loop for a chat message (streams output + dispatches tools). */
  processMessage(userInput: string): Promise<void>;
  /** Ctrl+C mid-turn: stop the model call in flight. False when nothing was generating. */
  cancelActiveTurn(): boolean;
  /** Drop a cancel armed during a tool call that no later model call ever consumed. */
  clearPendingCancel(): void;
  /** The `/stop` wind-down request for the run in flight (armed here, read by the loops). */
  readonly runStop: RunStopSignal;
  /** Run the V3/01 implement→test→review→fix loop for a backlog task (the Reviewer commits). */
  runTaskLoop(task: Task, specSlice: string, reporter: TaskLoopReporter): Promise<TaskLoopResult>;
  /** Spawn the V3/03 Retro window after a blocker is answered (patches the one right file). */
  spawnRetro(input: RetroInput): Promise<RetroResult>;
  /** Switch active phase; throws a clear Error on an unknown phase (REPL turns it into a line). */
  switchPhase(name: string): void;
  /** Phase names available for /swap, in a stable order. */
  availablePhases(): string[];
  /** /clear: start the active phase on a new context; names the one set aside (other phases untouched). */
  clearActivePhase(): ClearResult;
  /** /resume listing: the active phase's last `limit` contexts, most recently active first (no LLM call). */
  activePhaseContexts(limit: number): ContextSummary[];
  /**
   * /resume reopen: replay a context's turns into the active phase — the reopened context, or null if
   * the address matches none. The row comes back so `/resume <address>` can warn when the restored
   * history was written under a smaller num_ctx (there is no listing on that path to read it from).
   */
  reopenActiveContext(address: string): ContextSummary | null;
}

/** Run the REPL until the user types `/exit` (or EOF). */
export async function runRepl(orch: ReplOrchestrator): Promise<void> {
  renderer.clearScreen(); // one-time: wipe the launcher's boot noise for a clean start
  statusBar.enable(); // reserve the bottom rows so all output scrolls above them
  updateStatus(orch); // paint the two status lines immediately (there is no boot banner anymore)
  // A model-less session is valid but can't take a turn, so say so where it STICKS. Boot resolved the
  // model before we were called, but clearScreen above just wiped that exchange — this is the one
  // surface the user still sees. The status line shows the same state live.
  //
  // It NAMES NO MODEL (OPEN-QUESTIONS.md #8), and that is a decision rather than brevity. The reason
  // there is none may be an empty machine or a machine full of models that cannot call tools, and this
  // line cannot tell which — while config.SUGGESTED_MODEL is a suggestion for the EMPTY case whose own
  // tool support has never been verified. Naming it here would answer a capability problem with an
  // unverified model. Boot's own recommendation covers the empty machine (resolve-boot-model.ts), and
  // `/models list` marks tool support on a surface that survives the clearScreen above.
  if (orch.model === undefined) {
    renderer.systemMessage('No model selected. Pull one with tool support:  /models pull <name>');
  }
  // The no-op completer exists to SWALLOW Tab, and that is its whole job: with a completer registered,
  // readline neither self-inserts a literal tab nor runs its own completion. Both matter. Its inline
  // candidate print lands between the transient input rule and the input line, which puts the rule out
  // of reach of renderer's erase math and strands it in the append-only scrollback. Tab is driven
  // instead by the keypress handler below, which cycles through candidates in place and prints nothing.
  const rl = createInterface({
    input: stdin,
    output: stdout,
    completer: (line: string): [string[], string] => [[], line],
  });

  // Hand the fence the two things it cannot decide for itself (input-fence.ts keeps no session knowledge):
  // what Ctrl+C means mid-turn, and which submitted lines are control instructions rather than messages.
  inputFence.setHandlers({ cancel: () => requestCancel(orch), control: (line) => handleStopLine(orch, line) });

  // Multi-line composition: hand Shift+Enter (a bare LF) to the edit buffer instead of letting
  // readline submit on it, so the message keeps growing until Enter (a CR) sends the whole thing.
  // Must run before the status listener below — it replaces readline's keypress listener with its own.
  const unbindNewlineKey = bindNewlineKey(rl, stdin);

  // True only while a command / chat turn is being handled. Drives the live status ticker, and gates
  // Tab completion to idle — a completion redraws the prompt, which must never happen over a reply.
  let processing = false;

  // The Tab cycle in flight, or null when the last key was not a Tab. Dropping it on every other key is
  // half of what stops a stale cycle overwriting a word the user has since retyped; cycle-completion.ts
  // holds the other half, which re-checks that the line still reads as this handler left it.
  let cycle: CompletionCycle | null = null;

  // Turns are separated by one blank line; the very first prompt follows the header's own spacing, so
  // it skips the separator. Flipped false after the first input box is drawn.
  let firstPrompt = true;

  // readline erases from the cursor to the bottom of the screen (`ESC[0J`) on every line refresh —
  // prompt draw, backspace, arrow keys, history — which wipes the pinned rows. Repaint (with fresh
  // content) after each keypress so they survive editing. setImmediate defers to after readline has
  // finished writing its refreshed line this tick; the flag coalesces a burst (e.g. a paste) into one.
  let repaintScheduled = false;
  const scheduleStatus = (): void => {
    if (repaintScheduled) return;
    repaintScheduled = true;
    setImmediate(() => {
      repaintScheduled = false;
      updateStatus(orch); // refresh the status lines (e.g. a phase change via /swap) + paint them
      statusBar.repaint(); // readline's ESC[0J erased the pinned rows — restore all three
    });
  };
  // Two jobs per keystroke. A plain Tab steps the completion cycle; every other key drops the cycle. And
  // whatever the key, the pinned rows are repainted, since readline's ESC[0J erases them on every line
  // refresh. Shift+Tab is deliberately NOT claimed: readline's tab branch finds the no-op completer and
  // does nothing with it, so the key stays free rather than acquiring a second meaning.
  const onKeypress = (_str: string | undefined, key: Key | undefined): void => {
    if (isCompletionKey(key) && !processing) cycle = completeAtCursor(orch, rl, cycle);
    else cycle = null;
    scheduleStatus();
  };
  if (stdin.isTTY) stdin.on('keypress', onKeypress);

  // While a turn runs, repaint on an interval so the activity line's spinner + elapsed timer tick
  // (nothing else repaints during a long `await`); the status lines refresh in the same tick.
  let ticker: ReturnType<typeof setInterval> | null = null;
  const startTicker = (): void => {
    if (ticker === null) {
      ticker = setInterval(() => {
        updateStatus(orch);
        activityLine.repaint();
      }, STATUS_TICK_MS);
    }
  };
  const stopTicker = (): void => {
    if (ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
  };

  try {
    while (true) {
      // Repaint before each prompt: after a turn it carries fresh tokens, after a phase change the new
      // phase. It updates the pinned rows in place — never reprinted into the scrollback.
      updateStatus(orch);

      // A failed `rl.question` means stdin is gone (EOF / Ctrl+D / readline closed) — there is no input
      // left to read, so end the session gracefully instead of spinning on a dead stream.
      let line: string;
      let raw = '';
      try {
        // Fence the live input: a transient rule ABOVE it (erased on submit) and the pinned rule BELOW
        // it (status-bar's reserved row). On submit the box collapses into a static gray user-message
        // block — history stays clean (no rules), turns separated by a single blank line. The box grows
        // downward as Shift+Enter adds lines; the erase measures the wrapped rows, so it all comes back.
        if (!firstPrompt) renderer.blankLine();
        firstPrompt = false;
        renderer.inputRuleTop();
        const answer = rl.question(INPUT_PROMPT);
        // Anything typed while the turn ran was held in the fenced row rather than echoed into the
        // reply (input-fence.ts). Hand it to readline as if it had just been typed here, so the box
        // opens where the user left off — with full editing back, and Enter working again.
        const typedAhead = inputFence.drain();
        if (typedAhead !== '') rl.write(typedAhead);
        statusBar.repaint(); // readline drew the prompt (and erased the rows) synchronously — restore them
        raw = await answer;
        line = raw.trim();
      } catch {
        break;
      }
      if (line === '') {
        renderer.discardInput(raw); // empty submit: erase the box, add nothing to history
        continue;
      }
      renderer.commitUserMessage(raw); // collapse the box into a static gray user-message line + blank

      processing = true;
      startTicker();
      let exitRequested = false;
      try {
        exitRequested = await runInput(orch, line, rl);
        // Messages submitted while the turn ran were queued, not sent (input-fence.ts). They run now,
        // in the order they were written, each one exactly as if it had been typed at the prompt — a
        // queued `/command` included. The queue may grow while it drains, since every message here
        // runs a turn of its own with the fence up, so this reads it until it is genuinely empty.
        while (!exitRequested) {
          const queued = messageQueue.dequeue();
          if (queued === null) break;
          renderer.printUserMessage(queued); // no live box to collapse — print the gray block outright
          exitRequested = await runInput(orch, queued, rl);
        }
      } finally {
        stopTicker();
        processing = false;
        statusActivity.reset(); // clear any lingering tool/turn state so idle shows no activity field
        inputFence.reset(); // a turn that threw mid-flight must never leave stdin captured (dead prompt)
        // Same reasoning as the fence reset: a Ctrl+C armed during a tool call that no later model call
        // consumed must not survive into an unrelated turn the user starts afterwards.
        orch.clearPendingCancel();
      }
      if (exitRequested) break;
    }
  } finally {
    activityLine.hide();
    inputFence.reset(); // give stdin back before the interface closes, whatever ended the loop
    stopTicker();
    unbindNewlineKey(); // give readline its own keypress listener back before the interface closes
    if (stdin.isTTY) stdin.removeListener('keypress', onKeypress);
    statusBar.disable(); // release the reserved rows and restore normal scrolling
    rl.close();
  }
}
