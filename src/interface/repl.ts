// The persistent REPL loop: read a line, dispatch a `/command` through the registry (V5/03: EVERY
// command is registry-backed now — no fallback switch) or run it as a chat message, and keep the
// pinned bottom rows (rule + two status lines) fresh. Streaming output + the activity line are driven
// by the orchestrator's turn loop; this loop reads input, renders the shell around it, and paints status.
//
// Scrollback is preserved: a plain readline interface writes to the normal buffer (no alt-screen). The
// one-time clearScreen() at boot wipes launcher noise; the status bar reserves the bottom rows (see
// status-bar.ts) but the conversation and input stay in the scrolling area, copyable as ever.

import { createInterface } from 'node:readline/promises';
import type { Interface as ReadlineInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import type {
  ArchiveSummary,
  ClearResult,
  RetroInput,
  RetroResult,
  SubagentInfo,
  Task,
  TaskLoopReporter,
  TaskLoopResult,
} from '../core/session/index.js';
import { SUGGESTED_MODEL } from '../core/session/index.js';
import * as renderer from '../core/ui/renderer.js';
import * as statusActivity from '../core/ui/status-activity.js';
import * as statusBar from '../core/ui/status-bar.js';
import * as activityLine from '../core/ui/activity-line.js';
import * as inputFence from '../core/ui/input-fence.js';
import * as messageQueue from '../core/ui/message-queue.js';
import { bindNewlineKey } from '../core/ui/bind-newline-key.js';
import { theme } from '../core/ui/theme.js';
import { getCommand } from './command-registry.js';

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
  /** Run the V3/01 implement→test→review→fix loop for a backlog task (the Reviewer commits). */
  runTaskLoop(task: Task, specSlice: string, reporter: TaskLoopReporter): Promise<TaskLoopResult>;
  /** Spawn the V3/03 Retro window after a blocker is answered (patches the one right file). */
  spawnRetro(input: RetroInput): Promise<RetroResult>;
  /** Switch active phase; throws a clear Error on an unknown phase (REPL turns it into a line). */
  switchPhase(name: string): void;
  /** Phase names available for /swap, in a stable order. */
  availablePhases(): string[];
  /** /clear (V4/04): archive the active phase's history and reset it in-RAM (other phases untouched). */
  clearActivePhase(): ClearResult;
  /** /resume (V4/04): the active phase's last `limit` archives, most recent first (summaries from JSONL). */
  activePhaseArchives(limit: number): ArchiveSummary[];
  /** /resume (V4/04): restore a chosen archive back into the active file and reload it into RAM. */
  resumeActivePhaseArchive(basename: string): void;
}

/** Run the REPL until the user types `/exit` (or EOF). */
export async function runRepl(orch: ReplOrchestrator): Promise<void> {
  renderer.clearScreen(); // one-time: wipe the launcher's boot noise for a clean start
  statusBar.enable(); // reserve the bottom rows so all output scrolls above them
  updateStatus(orch); // paint the two status lines immediately (there is no boot banner anymore)
  // A model-less session is valid but can't take a turn, so say so where it STICKS. Boot resolved the
  // model (and offered a download) before we were called, but clearScreen above just wiped that
  // exchange — this is the one surface the user still sees. The status line shows the same state live.
  if (orch.model === undefined) {
    renderer.systemMessage(`No model selected. Pull one with  /models pull ${SUGGESTED_MODEL}`);
  }
  const rl = createInterface({ input: stdin, output: stdout });

  // Multi-line composition: hand Shift+Enter (a bare LF) to the edit buffer instead of letting
  // readline submit on it, so the message keeps growing until Enter (a CR) sends the whole thing.
  // Must run before the status listener below — it replaces readline's keypress listener with its own.
  const unbindNewlineKey = bindNewlineKey(rl, stdin);

  // True only while a command / chat turn is being handled — drives the live status ticker.
  let processing = false;

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
  // The keypress handler now does ONE thing: repaint the pinned rows after each keystroke (readline's
  // ESC[0J erases them on every line refresh). Completion and the Shift+Tab phase-cycle were removed.
  const onKeypress = (): void => scheduleStatus();
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
        const answer = rl.question(renderer.INPUT_PROMPT);
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

/**
 * Repaint the two pinned STATUS lines:
 *   line 1  `Phase: <Name> | Ctx: N%`  — the active phase (Capitalized, in its theme color) and the
 *           context-window fill: the phase's EXACT cumulative tokens as a percent of num_ctx.
 *   line 2  `Model: <model> | Project: <project>`.
 * Ctx is an EXACT count (constitution) shown as `0%` when the phase has no completed turn yet — never
 * a `?%` and never a length-based estimate. `no model` when none is selected, so the line never
 * implies a loaded model when a turn would fail.
 */
function updateStatus(orch: ReplOrchestrator): void {
  const filled = orch.activePhaseTokenTotal ?? 0;
  const ctxPct = orch.numCtx > 0 ? Math.round((filled / orch.numCtx) * 100) : 0;
  const line1 =
    theme.phase(orch.activePhase)(`Phase: ${capitalize(orch.activePhase)}`) + theme.meta(` | Ctx: ${ctxPct}%`);
  const line2 = theme.meta(`Model: ${orch.model ?? 'no model'} | Project: ${orch.project}`);
  statusBar.setStatus(line1, line2);
}

/** Capitalize the first letter for display (discovery → Discovery). */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Run ONE line of input — a `/command` or a chat message — returning true only when it asked to exit.
 *
 * Any error is SHOWN and swallowed here rather than at the loop: one bad turn (a dropped Ollama stream,
 * a tool blowup) must never kill the session, and must not strand the messages queued behind it either.
 * Only genuinely fatal errors that escape to `main().catch` (boot failures, Node runtime faults) end
 * the app, printing to the console.
 */
async function runInput(orch: ReplOrchestrator, input: string, rl: ReadlineInterface): Promise<boolean> {
  try {
    if (input.startsWith('/')) return await handleCommand(orch, input, rl);
    await orch.processMessage(input);
  } catch (err) {
    activityLine.hide(); // the activity line may still be up if the turn threw mid-stream
    renderer.errorLine(`✖ ${err instanceof Error ? err.message : String(err)}`);
  }
  return false;
}

/**
 * Dispatch a `/command` through the registry (every command lives there now — V5/03). Unknown commands
 * get a recoverable hint. Returns true only when a command requested exit (`/exit`), signalling the loop
 * to stop; every other command returns false.
 */
async function handleCommand(orch: ReplOrchestrator, input: string, rl: ReadlineInterface): Promise<boolean> {
  const withoutSlash = input.slice(1);
  const [command, ...rest] = withoutSlash.split(/\s+/);

  const registered = getCommand(command ?? '');
  if (registered === undefined) {
    renderer.errorLine(`Unknown command: /${command ?? ''}. Type /help for the list.`);
    return false;
  }

  let exitRequested = false;
  await registered.run({
    orch,
    rl,
    args: rest,
    raw: withoutSlash,
    requestExit: () => {
      exitRequested = true;
    },
  });
  return exitRequested;
}
