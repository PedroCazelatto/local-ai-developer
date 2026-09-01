// The `/new-project` run handler: scaffold under the orchestrator's own projects/ root, then report
// the outcome as one line. Split out of new-project.ts, whose object already carried the one-line
// `complete:` arrow — a second inline arrow beside it would be a second declaration.
//
// It takes the whole CommandContext rather than just the args, so the object registers it by name
// (`run: runNewProject`) instead of wrapping it in an arrow, which is the shape src/commands/run.ts
// established for /models.

import path from 'node:path';

import { renderer } from '../../core/ui/renderer.js';
import type { CommandContext } from '../command-context.type.js';
import { scaffoldProject } from './scaffold-project.js'; // validate, write the tree, `git init`; prints nothing

/** Scaffold the named project and report the outcome. The session stays on the project it booted with. */
export function runNewProject(ctx: CommandContext): void {
  // The session stays locked to its current project; scaffold under the orchestrator's projects/ root.
  const projectsRoot = path.resolve(process.cwd(), 'projects');
  const outcome = scaffoldProject(ctx.args, projectsRoot);
  if (outcome.ok) {
    renderer.systemMessage(outcome.message);
  } else {
    renderer.errorLine(outcome.message);
  }
}
