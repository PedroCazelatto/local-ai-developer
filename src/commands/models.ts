// /models (V5/02) — the model picker: `list` (installed models, active one marked), `pull <name>`
// (streamed, Ctrl-C-abortable, BLOCKS until done), `use <name>` (switch the live session model,
// persisted to state.json). When `use` names a model that isn't pulled yet, it doesn't error — it
// offers to download it inline via a single-keypress y/n confirm (no Enter), pulls on `y`, then
// switches. A user command, never a model tool — the model never picks its own runtime, so this lives
// in src/commands/ and hangs off the command registry (V5/02), not src/tools/. All talk to the HOST
// Ollama daemon directly (Ollama runs on the host GPU, not the sandbox — CLAUDE.md); the session
// orchestrator only holds/applies the active model.
//
// A cohesive command module (dispatch + the three subcommands + formatters), like resume.ts/subagents.ts
// — not one function per file.

import type { Command, CommandContext } from '../interface/command-registry.js';
import { hasModel, listModels, matchesModelName } from '../core/llm/index.js';
import { saveAppState } from '../core/session/index.js';
import { confirmKey } from '../core/ui/confirm-key.js';
import { formatSize } from '../core/ui/format-size.js';
import { pullWithSpinner } from '../core/ui/pull-with-spinner.js';
import * as renderer from '../core/ui/renderer.js';
import { theme } from '../core/ui/theme.js';

const USAGE = 'Usage: /models list | pull <name> | use <name>';

/** The subcommands `run` dispatches on, as Tab candidates. Kept beside that switch so the two stay in step. */
const SUBCOMMANDS: readonly string[] = ['list', 'pull', 'use'];

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Local `YYYY-MM-DD HH:mm` for the last-modified column. Coerces (the daemon may hand back a string). */
function formatModified(value: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())} ${p2(date.getHours())}:${p2(date.getMinutes())}`;
}

/** `/models list` — print the installed models with the active one marked, or a hint if none are pulled. */
async function listSubcommand(ctx: CommandContext): Promise<void> {
  const installed = await listModels();
  if (installed.length === 0) {
    renderer.systemMessage('No models installed locally. Pull one with  /models pull <name>');
    return;
  }
  // undefined when the session has no model selected — then nothing is marked active, which is the truth.
  const active = ctx.orch.model;
  const nameWidth = Math.max(...installed.map((m) => m.name.length), 4);

  write('');
  write(theme.strong('Installed models:'));
  write('');
  for (const m of installed) {
    // matchesModelName: exact tag, or the implicit `:latest` when `active` is tagless.
    const isActive = active !== undefined && matchesModelName(m.name, active);
    const marker = isActive ? theme.success('●') : ' ';
    const nameCol = m.name.padEnd(nameWidth);
    const namePainted = isActive ? theme.success(nameCol) : nameCol;
    const size = theme.meta(formatSize(m.size).padStart(9));
    const modified = theme.meta(formatModified(m.modifiedAt));
    write(`  ${marker} ${namePainted}   ${size}   ${modified}`);
  }
  write('');
  write(theme.meta(`  ● active · ${installed.length} model${installed.length === 1 ? '' : 's'} · /models use <name> to switch`));
  write('');
}

/**
 * `/models pull <name>` — stream the pull, then point the user at `/models use` on success.
 * pullWithSpinner runs a live ora line and BLOCKS until the pull finishes (the REPL is single-threaded,
 * so nothing else runs until it resolves), reporting a cancel/error itself and leaving 'ok' to us to
 * phrase. `ctx.rl` is the SIGINT source: readline emits its own 'SIGINT' on Ctrl-C while the interface is
 * live (it owns the TTY), so the abort stays scoped to this pull and the REPL survives it.
 */
async function pullSubcommand(ctx: CommandContext, name: string | undefined): Promise<void> {
  if (name === undefined || name === '') {
    renderer.errorLine('Usage: /models pull <name>');
    return;
  }
  if ((await pullWithSpinner(name, ctx.rl)) === 'ok') {
    renderer.systemMessage(`Pulled ${name}. Switch to it with  /models use ${name}`);
  }
}

/**
 * Apply `name` as the live session model (the next phase turn + any newly spawned window/sub-agent uses
 * it) and persist the choice so the next `run start` defaults to it. Persistence is best-effort: a failed
 * write still leaves the session switched, with a warning. Caller guarantees `name` is actually pulled.
 */
function applyModel(ctx: CommandContext, name: string): void {
  ctx.orch.useModel(name);
  renderer.systemMessage(`→ model: ${name}`);
  try {
    saveAppState({ activeModel: name });
  } catch (err) {
    renderer.systemMessage(`  (switched, but couldn't persist to state.json: ${errMessage(err)} — applies this session only)`);
  }
}

/**
 * `/models use <name>` — switch the live session model. If `name` isn't pulled yet, we don't error: we
 * ask "Download it now? (y/n)" answered by a SINGLE keystroke (no Enter, via confirmKey), and on `y`
 * pull it (blocking, Ctrl-C-abortable) and then switch. On `n`/cancel we leave the current model in
 * place. hasModel is the guard so an unknown name never reaches Ollama; a merely-started pull still
 * counts as not-present.
 */
async function useSubcommand(ctx: CommandContext, name: string | undefined): Promise<void> {
  if (name === undefined || name === '') {
    renderer.errorLine('Usage: /models use <name>');
    return;
  }
  if (name === ctx.orch.model) {
    renderer.systemMessage(`Already using ${name}.`);
    return;
  }
  const present = await hasModel(name);
  if (!present) {
    // confirmKey blocks on one y/n keystroke (no Enter); false on n / Esc / Ctrl-C / non-TTY.
    const wantsPull = await confirmKey(`Model '${name}' isn't pulled. Download it now?`);
    if (!wantsPull) {
      const current = ctx.orch.model;
      renderer.systemMessage(
        current === undefined ? 'Still no model selected.' : `Kept current model — still using ${current}.`,
      );
      return;
    }
    // pullWithSpinner reports cancel/error itself; only 'ok' means the blob is present and we can switch.
    if ((await pullWithSpinner(name, ctx.rl)) !== 'ok') return;
  }
  applyModel(ctx, name);
}

/** Dispatch `/models <sub>` — bare `/models` lists; an unknown subcommand prints usage. */
async function run(ctx: CommandContext): Promise<void> {
  const sub = ctx.args[0];
  switch (sub) {
    case undefined:
    case 'list':
      await listSubcommand(ctx);
      return;
    case 'pull':
      await pullSubcommand(ctx, ctx.args[1]);
      return;
    case 'use':
      await useSubcommand(ctx, ctx.args[1]);
      return;
    default:
      renderer.errorLine(`Unknown subcommand '/models ${sub}'. ${USAGE}`);
  }
}

export const modelsCommand: Command = {
  name: 'models',
  group: 'models',
  description: 'List, pull, and switch the local Ollama model',
  usage: USAGE,
  // Tab: the subcommands only. Model NAMES are deliberately left uncompleted — listing them means an async
  // call to the Ollama daemon, and an async completer blanks the pinned rows (see complete-line.ts). `pull`
  // names aren't local anyway; they're arbitrary registry strings.
  complete: (ctx) => (ctx.args.length === 0 ? [...SUBCOMMANDS] : []),
  run,
};
