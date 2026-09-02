// `/models list` (V5/02) — the installed-model table, with the session's active model marked and any
// model that cannot call tools marked too. Talks to the HOST Ollama daemon (Ollama runs on the host
// GPU, not the sandbox — CLAUDE.md); the session orchestrator only holds the active model, it is never
// asked what is installed.
//
// THE TOOL-SUPPORT MARKER LIVES HERE (OPEN-QUESTIONS.md #14, #12 as clarified by #78). This list is
// where a user goes to ask why a model was skipped, so it is where the answer belongs — and it is one
// of exactly two surfaces that carry the marker, the other being the boot chooser. Nothing paints it
// in the pinned status rows: `/models use` refuses a toolless model, so no toolless model can ever be
// active and that marker would have had no way to paint. This is also the surface that SURVIVES the
// REPL's one-time clearScreen, which is why boot's own copy of the list cannot be the only one.

import { listModels } from '../core/llm/list-models.js';
import { matchesModelName } from '../core/llm/matches-model-name.js';
import { supportsTools } from '../core/llm/supports-tools.js';
import { formatSize } from '../core/ui/format-size.js';
import { NO_TOOLS_MARKER } from '../core/ui/no-tools-marker.js';
import { renderer } from '../core/ui/renderer.js';
import { theme } from '../core/ui/theme.js';
import { write } from '../core/ui/write.js';
import type { CommandContext } from '../interface/command-context.type.js';
import { formatModified } from './format-modified.js';

/** `/models list` — print the installed models, the active one marked and the toolless ones too. */
export async function listSubcommand(ctx: CommandContext): Promise<void> {
  // listModels asks the daemon for every installed model, projected and name-sorted.
  const installed = await listModels();
  if (installed.length === 0) {
    // Names no model: SUGGESTED_MODEL is boot's suggestion for an empty machine, and this line cannot
    // tell an empty machine from one whose models all failed the gate (OPEN-QUESTIONS.md #8).
    renderer.systemMessage('No models installed locally. Pull one with tool support:  /models pull <name>');
    return;
  }
  // undefined when the session has no model selected — then nothing is marked active, which is the truth.
  const active = ctx.orch.model;
  const nameWidth = Math.max(...installed.map((m) => m.name.length), 4);
  const toolless = installed.filter((m) => !supportsTools(m.capabilities)).length;

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
    // supportsTools: the `tools` capability from /api/tags; an unreadable field reads as [] and fails.
    const tools = supportsTools(m.capabilities) ? '' : theme.meta(`   ${NO_TOOLS_MARKER}`);
    write(`  ${marker} ${namePainted}   ${size}   ${modified}${tools}`);
  }
  write('');
  write(theme.meta(`  ● active · ${installed.length} model${installed.length === 1 ? '' : 's'} · /models use <name> to switch`));
  if (toolless > 0) {
    // Kept short deliberately: at 95 characters this legend wrapped an 80-column terminal, which the
    // grid replay caught. `/models use` explains the consequence in full when it refuses one.
    write(theme.meta(`  ${NO_TOOLS_MARKER} · ${toolless} of them can't call tools · /models use refuses them`));
  }
  write('');
}
