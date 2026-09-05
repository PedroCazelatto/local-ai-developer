// The `/models` dispatcher (V5/02) — bare `/models` lists, `pull`/`use` take a name, anything else
// prints the usage line. The Tab candidate list lives beside the command object in models.ts; keep it
// and the switch below in step.

import { renderer } from '../core/ui/renderer.js';
import type { CommandContext } from '../interface/command-registry.js';
import { listSubcommand } from './list-subcommand.js';
import { modelsCommand } from './models.js';
import { pullSubcommand } from './pull-subcommand.js';
import { useSubcommand } from './use-subcommand.js';

/** Dispatch `/models <sub>` — bare `/models` lists; an unknown subcommand prints usage. */
export async function run(ctx: CommandContext): Promise<void> {
  const sub = ctx.args[0];
  switch (sub) {
    case undefined:
    case 'list':
      // listSubcommand prints the installed-model table with the active model marked.
      await listSubcommand(ctx);
      return;
    case 'pull':
      // pullSubcommand streams the download and BLOCKS until it finishes.
      await pullSubcommand(ctx, ctx.args[1]);
      return;
    case 'use':
      // useSubcommand switches the live model, offering to pull it first when it isn't installed.
      await useSubcommand(ctx, ctx.args[1]);
      return;
    default:
      // The usage line is read off the assembled object HERE, inside the function body. This module sits
      // inside modelsCommand's own dependency subtree, so a module-evaluation-time read would run before
      // the object exists and throw `Cannot access 'modelsCommand' before initialization` (constitution).
      renderer.errorLine(`Unknown subcommand '/models ${sub}'. ${modelsCommand.usage}`);
  }
}
