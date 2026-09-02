// The switch half of `/models use` (V5/02) — applying a model that is already known to be pulled, and
// persisting the choice. Only an explicit `/models use` writes state.json, so a boot-time choice never
// overwrites a stated one (docs/cli.md, *Model selection*).

import { errMessage } from '../core/err-message.js';
import { saveAppState } from '../core/session/save-app-state.js';
import { renderer } from '../core/ui/renderer.js';
import type { CommandContext } from '../interface/command-context.type.js';

/**
 * Apply `name` as the live session model (the next phase turn + any newly spawned window/sub-agent uses
 * it) and persist the choice so the next `run start` defaults to it. Persistence is best-effort: a failed
 * write still leaves the session switched, with a warning. Caller guarantees `name` is actually pulled.
 */
export function applyModel(ctx: CommandContext, name: string): void {
  ctx.orch.useModel(name);
  renderer.systemMessage(`→ model: ${name}`);
  try {
    // saveAppState merges the patch into state.json — the file resolve-boot-model.ts reads at boot.
    saveAppState({ activeModel: name });
  } catch (err) {
    renderer.systemMessage(`  (switched, but couldn't persist to state.json: ${errMessage(err)} — applies this session only)`);
  }
}
