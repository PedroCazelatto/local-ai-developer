// `/models list` (V5/02) — the installed-model table, with the session's active model marked. Talks to
// the HOST Ollama daemon (Ollama runs on the host GPU, not the sandbox — CLAUDE.md); the session
// orchestrator only holds the active model, it is never asked what is installed.

import { listModels, matchesModelName } from '../core/llm/index.js';
import { formatSize } from '../core/ui/format-size.js';
import { renderer } from '../core/ui/renderer.js';
import { theme } from '../core/ui/theme.js';
import { write } from '../core/ui/write.js';
import type { CommandContext } from '../interface/command-registry.js';
import { formatModified } from './format-modified.js';

/** `/models list` — print the installed models with the active one marked, or a hint if none are pulled. */
export async function listSubcommand(ctx: CommandContext): Promise<void> {
  // listModels asks the daemon for every installed model, projected and name-sorted.
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
    // formatSize: bytes to a human-readable string; formatModified: local `YYYY-MM-DD HH:mm`.
    const size = theme.meta(formatSize(m.size).padStart(9));
    const modified = theme.meta(formatModified(m.modifiedAt));
    write(`  ${marker} ${namePainted}   ${size}   ${modified}`);
  }
  write('');
  write(theme.meta(`  ● active · ${installed.length} model${installed.length === 1 ? '' : 's'} · /models use <name> to switch`));
  write('');
}
