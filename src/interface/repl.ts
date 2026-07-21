// The persistent REPL loop: read a line, dispatch a `/command` through the registry (V5/03: EVERY
// command is registry-backed now — no fallback switch) or run it as a chat message, and keep the two
// pinned bottom rows (status line + footer hint) fresh. Streaming output + the spinner are driven by
// the orchestrator's turn loop; this loop reads input, renders the shell around it, and paints status.
//
// Scrollback is preserved: a plain readline interface writes to the normal buffer (no alt-screen). The
// one-time clearScreen() at boot wipes launcher noise; the status bar reserves the two bottom rows (see
// status-bar.ts) but the conversation and input stay in the scrolling area, copyable as ever.

import { createInterface } from 'node:readline/promises';
import type { Interface as ReadlineInterface } from 'node:readline/promises';
import type { Key } from 'node:readline';
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
import { theme } from '../core/ui/theme.js';
import { stopThinking } from '../core/ui/spinner.js';
import { getCommand } from './command-registry.js';
import { completeLine } from './complete-line.js';

/** The persistent hint shown on the pinned footer row — the wired-but-invisible keys, made visible. */
const FOOTER_HINT = 'Tab: complete · Shift+Tab: cycle phase · /swap <phase>: jump · /help: commands';

/** How often (ms) the status line repaints while a turn/command runs, to tick the live elapsed timer. */
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
  /** Current phase name — drives the status line + assistant prefix. */
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
  /** Run the V3/01 implement→test→review→fix loop for a backlog task (auto-commits on pass). */
  runTaskLoop(task: Task, specSlice: string, reporter: TaskLoopReporter): Promise<TaskLoopResult>;
  /** Spawn the V3/03 Retro window after a blocker is answered (patches the one right file). */
  spawnRetro(input: RetroInput): Promise<RetroResult>;
  /** Switch active phase; throws a clear Error on an unknown phase (REPL turns it into a line). */
  switchPhase(name: string): void;
  /** Phase names available for /swap and the Shift+Tab cycle, in a stable order. */
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
  statusBar.enable(); // reserve the two bottom rows BEFORE the header so all output scrolls above them
  statusBar.setFooter(theme.meta(FOOTER_HINT)); // static hint on the bottom pinned row
  renderer.header();
  // A model-less session is valid but can't take a turn, so say so where it STICKS. Boot resolved the
  // model (and offered a download) before we were called, but clearScreen above just wiped that
  // exchange — this is the one surface the user still sees. The status line shows the same state live.
  if (orch.model === undefined) {
    renderer.systemMessage(`No model selected. Pull one with  /models pull ${SUGGESTED_MODEL}`);
  }
  // completeLine: Tab-completes `/command` names off the registry and delegates the argument being typed
  // to that command's own complete(). Synchronous on purpose — readline prints its candidate list before
  // the keypress repaint below restores the pinned rows; an async completer would land after it and leave
  // them blank (see complete-line.ts).
  const rl = createInterface({
    input: stdin,
    output: stdout,
    completer: (line: string): [string[], string] => completeLine(line, orch),
  });

  // True only while a command / chat turn is being handled. Gates Shift+Tab (never cycle phase mid-turn:
  // an in-flight turn is bound to the active phase's history) and drives the live status ticker.
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
      updateStatus(orch); // refresh the status text (e.g. a Shift+Tab phase change) + paint the status row
      statusBar.repaint(); // readline's ESC[0J erased BOTH pinned rows — restore the footer row too
    });
  };
  // On Shift+Tab (back-tab), cycle the active phase so the user can flip phases without typing /swap;
  // the persistent color-coded phase field then shows which phase the next message will hit. Guarded to
  // idle only, so a keypress can never switch a phase out from under an in-flight turn.
  const onKeypress = (_str: string | undefined, key: Key | undefined): void => {
    if (key !== undefined && isBackTab(key) && !processing) {
      cyclePhase(orch, key.ctrl === true ? -1 : 1); // Ctrl+Shift+Tab goes backward where the terminal distinguishes it
    }
    scheduleStatus();
  };
  if (stdin.isTTY) stdin.on('keypress', onKeypress);

  // While a turn/command runs, repaint on an interval so the current-tool elapsed timer and the
  // thinking/since-last-tool field visibly tick (nothing else repaints during a long `await`).
  let ticker: ReturnType<typeof setInterval> | null = null;
  const startTicker = (): void => {
    if (ticker === null) ticker = setInterval(() => updateStatus(orch), STATUS_TICK_MS);
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
        // it (status-bar's reserved row). On submit the box collapses into ONE static gray user-message
        // line — history stays clean (no rules), turns separated by a single blank line.
        if (!firstPrompt) renderer.blankLine();
        firstPrompt = false;
        renderer.inputRuleTop();
        const answer = rl.question(renderer.INPUT_PROMPT);
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

      // Any error from a command or a turn is SHOWN and swallowed — one bad turn (a dropped Ollama
      // stream, a tool blowup) must never kill the session. Only genuinely fatal errors that escape to
      // `main().catch` (boot failures, Node runtime faults) end the app, printing to the console.
      processing = true;
      startTicker();
      try {
        if (line.startsWith('/')) {
          if (await handleCommand(orch, line, rl)) break; // /exit requested
        } else {
          await orch.processMessage(line);
        }
      } catch (err) {
        stopThinking(); // a spinner may still be running if the turn threw mid-stream
        renderer.errorLine(`✖ ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        stopTicker();
        processing = false;
        statusActivity.reset(); // clear any lingering tool/turn state so idle shows no activity field
      }
    }
  } finally {
    stopThinking();
    stopTicker();
    if (stdin.isTTY) stdin.removeListener('keypress', onKeypress);
    statusBar.disable(); // release the reserved rows and restore normal scrolling
    rl.close();
  }
}

/** True for Shift+Tab (back-tab): most terminals send `ESC[Z`, surfaced as name `tab` with `shift`. */
function isBackTab(key: Key): boolean {
  return (key.name === 'tab' && key.shift === true) || key.sequence === '\x1b[Z';
}

/** Advance the active phase by `dir` (+1 next / -1 previous), wrapping around availablePhases(). */
function cyclePhase(orch: ReplOrchestrator, dir: 1 | -1): void {
  const phases = orch.availablePhases();
  if (phases.length === 0) return;
  const current = phases.indexOf(orch.activePhase);
  const base = current === -1 ? 0 : current;
  const next = phases[(base + dir + phases.length) % phases.length];
  if (next !== undefined && next !== orch.activePhase) {
    orch.switchPhase(next); // synchronous: swaps the active-phase pointer + lazy-loads its history
  }
}

/**
 * Repaint the pinned STATUS line: the live session context — `project · phase · model · tokens/num_ctx`
 * plus a conditional `Subagents: N` and a live activity field (running tool + elapsed, or thinking).
 * The active phase renders in its theme color (persistent, so the user always sees which phase the next
 * message hits); the rest is dim. Tokens are the EXACT last-turn total, or `?` when Ollama reported
 * none for the last turn — never a length-based guess (constitution).
 */
function updateStatus(orch: ReplOrchestrator): void {
  const tokens = orch.lastTurnTokenTotal === null ? '?' : String(orch.lastTurnTokenTotal);
  // Cumulative EXACT per-phase total (V5/04), compact `Σ45.2k`: `Σ?` when a turn's count was
  // unreported (incomplete, never estimated), and omitted entirely before the phase's first turn.
  const phaseTotal = orch.activePhaseTokenTotal;
  const phaseField = phaseTotal === null ? ' · Σ?' : phaseTotal > 0 ? ` · Σ${compactTokens(phaseTotal)}` : '';
  // `Subagents: N` is appended only while any are active (V5/01); dropped entirely at zero.
  const subs = orch.subagentCount > 0 ? ` · Subagents: ${orch.subagentCount}` : '';
  // The live activity field (V5/03): `running <tool> (X.Xs)` while a tool runs, else a thinking/stall
  // timer while a turn streams, else null (idle) → the field is omitted.
  const activity = statusActivity.label();
  const activityField = activity !== null ? ` · ${activity}` : '';
  // `no model` (not a blank or a guessed name) when none is selected — the pinned line must never imply
  // a model is loaded when a turn would fail. It appears the moment /models use|pull resolves one.
  const model = orch.model ?? 'no model';
  const head = theme.meta(`${orch.project} · `);
  const phase = theme.phase(orch.activePhase)(orch.activePhase);
  const tail = theme.meta(` · ${model} · ${tokens}/${orch.numCtx} tok${phaseField}${subs}${activityField}`);
  statusBar.setStatus(`${head}${phase}${tail}`);
}

/** Compact a token count for the status line: `945` · `45.2k` · `1.3M` — keeps the pinned line scannable. */
function compactTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
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
