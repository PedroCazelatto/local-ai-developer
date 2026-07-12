// The persistent REPL loop: read a line, classify command vs chat message, call the orchestrator,
// and repaint the pinned status line. Streaming output + the spinner are driven by the
// orchestrator's turn loop (task 06); this loop only reads input and renders the shell around it.
//
// Scrollback is preserved: a plain readline interface writes to the normal buffer (no alt-screen).
// The one-time clearScreen() at boot wipes launcher noise; the status bar reserves the bottom row
// (see status-bar.ts) but the conversation and input stay in the scrolling area, copyable as ever.

import { createInterface } from 'node:readline/promises';
import type { Interface as ReadlineInterface } from 'node:readline/promises';
import path from 'node:path';
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
import * as renderer from '../core/ui/renderer.js';
import * as statusBar from '../core/ui/status-bar.js';
import { stopThinking } from '../core/ui/spinner.js';
import { getCommand } from './command-registry.js';
import { answerCommand } from './commands/answer.js';
import { clearCommand } from './commands/clear.js';
import { newProjectCommand } from './commands/new-project.js';
import { resumeCommand } from './commands/resume.js';
import { runCommand } from './commands/run.js';
import { subagentsCommand } from './commands/subagents.js';

/**
 * What the REPL needs from the orchestrator (task 06's SessionOrchestrator satisfies this
 * structurally). Kept as an interface so this loop builds and reasons independently of 06.
 */
export interface ReplOrchestrator {
  readonly project: string;
  /** Live session model (V5/02) — the status line reads it; /models use changes it via useModel. */
  readonly model: string;
  readonly numCtx: number;
  /** Current phase name — drives the status line + assistant prefix. */
  readonly activePhase: string;
  /** /models use (V5/02): switch the live session model; the next turn + new windows/sub-agents use it. */
  useModel(name: string): void;
  /** Host path to projects/<active> — the /run command reads the backlog from here. */
  readonly projectPath: string;
  /** EXACT combined tokens from the last turn, or null if Ollama didn't report them. */
  readonly lastTurnTokenTotal: number | null;
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
  /** Phase names available for /swap, for the unknown-phase error message. */
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
  statusBar.enable(); // reserve the bottom row BEFORE the header so all output scrolls above it
  renderer.header();
  const rl = createInterface({ input: stdin, output: stdout });

  // readline erases from the cursor to the bottom of the screen (`ESC[0J`) on every line refresh —
  // prompt draw, backspace, arrow keys, history — which wipes the pinned bottom row. Repaint the bar
  // after each keypress so it survives editing. setImmediate defers the repaint to after readline has
  // finished writing its refreshed line this tick; the flag coalesces a burst (e.g. a paste) into one.
  let repaintScheduled = false;
  const repaintBar = (): void => {
    if (repaintScheduled) return;
    repaintScheduled = true;
    setImmediate(() => {
      repaintScheduled = false;
      statusBar.repaint();
    });
  };
  if (stdin.isTTY) stdin.on('keypress', repaintBar);

  try {
    while (true) {
      // Repaint the pinned status line before each prompt: after a turn it carries fresh tokens,
      // after /swap the new phase. It updates in place on the bottom row — never reprinted.
      updateStatus(orch);

      // A failed `rl.question` means stdin is gone (EOF / Ctrl+D / readline closed) — there is no
      // input left to read, so end the session gracefully instead of spinning on a dead stream.
      let line: string;
      try {
        const answer = rl.question('› ');
        statusBar.repaint(); // readline drew the prompt (and erased the bar) synchronously — restore it
        line = (await answer).trim();
      } catch {
        break;
      }
      if (line === '') continue;

      // Any error from a command or a turn is SHOWN and swallowed — one bad turn (a dropped Ollama
      // stream, a tool blowup) must never kill the session. Only genuinely fatal errors that escape
      // to `main().catch` (boot failures, Node runtime faults) end the app, printing to the console.
      try {
        if (line.startsWith('/')) {
          if (await handleCommand(orch, line, rl)) break; // /exit
          continue;
        }
        await orch.processMessage(line);
      } catch (err) {
        stopThinking(); // a spinner may still be running if the turn threw mid-stream
        renderer.errorLine(`✖ ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    stopThinking();
    if (stdin.isTTY) stdin.removeListener('keypress', repaintBar);
    statusBar.disable(); // release the reserved row and restore normal scrolling
    rl.close();
  }
}

/**
 * Repaint the pinned status line (bottom row, below the input): the full session context —
 * `project · phase · model · exact tokens / num_ctx`. Tokens are the exact last-turn total, or `0`
 * before the first turn reports counts (Ollama hasn't returned any yet).
 */
function updateStatus(orch: ReplOrchestrator): void {
  const tokens = orch.lastTurnTokenTotal === null ? '0' : String(orch.lastTurnTokenTotal);
  // `Subagents: N` is appended only while any are active (V5/01); dropped entirely at zero.
  const subs = orch.subagentCount > 0 ? ` · Subagents: ${orch.subagentCount}` : '';
  statusBar.set(`${orch.project} · ${orch.activePhase} · ${orch.model} · ${tokens}/${orch.numCtx} tok${subs}`);
}

/** Dispatch a `/command`. Returns true only for `/exit` (signals the loop to stop). */
async function handleCommand(orch: ReplOrchestrator, input: string, rl: ReadlineInterface): Promise<boolean> {
  const withoutSlash = input.slice(1);
  const [command, ...rest] = withoutSlash.split(/\s+/);

  // Registry-backed commands first (V5/02, e.g. /models). The switch below holds the not-yet-migrated
  // commands; V5/03 migrates the rest and adds /help off the same registry. None of these exit the REPL.
  const registered = getCommand(command ?? '');
  if (registered) {
    await registered.run({ orch, rl, args: rest, raw: withoutSlash });
    return false;
  }

  switch (command) {
    case 'exit':
      return true;
    case 'run':
      // Execution trigger (V3/01): run tasks sequentially through the implement→test→review→fix loop
      // — auto-committing each pass; the user is pulled in only on an escalation or a blocker.
      await runCommand(rest, orch);
      return false;
    case 'answer':
      // Resolve a blocker the Reviewer raised (V3/02): record the answer + re-queue the task, then spawn
      // Retro (V3/03) to patch the offending file. Pass the raw line so the answer text keeps its
      // spacing, and the orchestrator so Retro can run; the loop is stopped, so this is safe now.
      await answerCommand(input, orch);
      return false;
    case 'new-project': {
      // A user command, never a model tool — scaffolds a NEW project on disk (the session stays
      // locked to its current project; the user restarts to work on the new one).
      const projectsRoot = path.resolve(process.cwd(), 'projects');
      const outcome = newProjectCommand(rest, projectsRoot);
      if (outcome.ok) {
        renderer.systemMessage(outcome.message);
      } else {
        renderer.errorLine(outcome.message);
      }
      return false;
    }
    case 'swap': {
      const target = rest[0];
      if (target === undefined || target === '') {
        renderer.errorLine(`Usage: /swap <phase>. Available: ${orch.availablePhases().join(', ')}`);
        return false;
      }
      try {
        orch.switchPhase(target);
        renderer.systemMessage(`→ phase: ${orch.activePhase}`);
      } catch (err) {
        // Unknown phase (or any switch failure) is recoverable — print, keep the REPL alive.
        renderer.errorLine(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
    case 'clear':
      // Wipe ONLY the active phase's history (V4/04): archive its JSONL + reset in-RAM, no confirm.
      clearCommand(orch);
      return false;
    case 'subagents':
      // List the live sub-agents this session spawned (V5/01): id, age, message count, exact tokens.
      subagentsCommand(orch);
      return false;
    case 'resume':
      // Restore one of the active phase's last-3 archives (V4/04): prompts over the REPL's readline.
      await resumeCommand(orch, rl);
      return false;
    default:
      // /models is handled above via the command registry (V5/02). Shift+Tab phase-cycle and /help are V5/03.
      renderer.errorLine(`Unknown command: /${command ?? ''}`);
      return false;
  }
}
