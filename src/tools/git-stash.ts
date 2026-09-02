// git_stash — shelve uncommitted work and bring it back. Host-side like every git tool (the root
// sandbox is a slim image that ships no git, so `execute_command "git stash"` cannot work).
//
// A shelf is addressed by a LABEL the model chooses, never by `stash@{n}`: an index shifts the moment
// anything else is stashed, and the task loop stashes on its own schedule. The labels live in a
// namespace disjoint from the task loop's own `lad-stash:<taskId>` records — the stashed failed
// attempt Retro reads and the user reviews — so nothing the model does here can reach one. See
// shelf-label.ts for why that separation is the whole reason this file exists.
//
// Withheld from the Worker: it could otherwise shelve the very work the Reviewer is about to judge,
// leaving the Reviewer a clean tree and no code (worker-runner refuses it; phase-tool-names omits it).

import { dropShelf } from '../core/session/drop-shelf.js';
import { isValidShelfLabel } from '../core/session/is-valid-shelf-label.js';
import { listShelves } from '../core/session/list-shelves.js';
import { popShelf } from '../core/session/pop-shelf.js';
import { saveShelf } from '../core/session/save-shelf.js';
import { shelfLabelError } from '../core/session/shelf-label-error.js';
import type { JsonObject } from './json-object.type.js';
import type { JsonValue } from './json-value.type.js';
import { toolError } from './tool-error.js';
import type { ToolModule } from './tool-module.type.js';
import type { ToolResult } from './tool-result.type.js';

export const GIT_STASH = 'git_stash';

const ACTIONS = ['save', 'list', 'pop', 'drop'] as const;
type StashAction = (typeof ACTIONS)[number];

/** The actions that address one specific shelf, and so require a label. */
const LABEL_REQUIRED: readonly StashAction[] = ['save', 'pop', 'drop'];

function isAction(value: unknown): value is StashAction {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);
}

/** The shelf list as model-facing JSON — also the `available` list on a bad-label error. */
function shelvesPayload(projectPath: string): JsonValue[] {
  return listShelves(projectPath).map((shelf) => ({ label: shelf.label, branch: shelf.branch, when: shelf.when }));
}

export const gitStashTool: ToolModule = {
  name: GIT_STASH,
  description:
    'Shelve your uncommitted work under a name and bring it back later. `save` puts the whole working ' +
    'tree (including new files) on a shelf and leaves the tree clean; `list` shows your shelves; `pop` ' +
    'restores one and removes it; `drop` discards one without restoring it. Use it to park work you are ' +
    'not ready to commit — for example before switching to an existing branch, which is refused while ' +
    'the tree is dirty. You only ever see your own shelves.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'One of "save", "list", "pop", "drop".',
      },
      label: {
        type: 'string',
        description:
          'Names the shelf, e.g. "wip-auth". Required for save/pop/drop, ignored by list. Letters, ' +
          'digits, ".", "-" and "_" only. A label already in use is refused rather than overwritten.',
      },
    },
    required: ['action'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const action = args['action'];
    if (!isAction(action)) {
      return toolError(
        `'action' must be one of: ${ACTIONS.join(', ')}.`,
        'Call git_stash with action:"list" to see what is shelved.',
      );
    }

    const metadata: JsonObject = { project: ctx.projectName, action };

    if (action === 'list') {
      // listShelves: `git stash list`, filtered to the model's own `lad-shelf:` entries — a task-loop
      // stash is never shown, and so can never be named back at pop/drop.
      const shelves = shelvesPayload(ctx.projectPath);
      return {
        content: { shelves, count: shelves.length },
        metadata: { ...metadata, count: shelves.length },
        display: { summary: `${shelves.length} shelf${shelves.length === 1 ? '' : 'ves'}` },
      };
    }

    const rawLabel = args['label'];
    if (LABEL_REQUIRED.includes(action) && typeof rawLabel !== 'string') {
      return toolError(`'label' is required for action "${action}".`, 'Name the shelf, e.g. label:"wip-auth".');
    }
    const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';
    if (!isValidShelfLabel(label)) {
      return toolError(shelfLabelError(label), 'Use only letters, digits, ".", "-" and "_".');
    }

    if (action === 'save') {
      // saveShelf: `git stash push -u -m lad-shelf:<label>`. Refuses a label already in use (an
      // overwrite would destroy work the model believes it still has) and refuses a clean tree.
      const saved = saveShelf(ctx.projectPath, label);
      if (!saved.ok) {
        return toolError(saved.error ?? 'git stash failed.', 'Call git_stash with action:"list" to see your shelves.');
      }
      return {
        content: { saved: true, label, note: 'the working tree is now clean.' },
        metadata: { ...metadata, label },
        display: { summary: 'saved — the working tree is clean' },
      };
    }

    const result = action === 'pop' ? popShelf(ctx.projectPath, label) : dropShelf(ctx.projectPath, label);
    if (!result.ok) {
      return {
        content: { error: result.error ?? 'git stash failed.', shelves: shelvesPayload(ctx.projectPath) },
        exitStatus: -1,
        error: result.error ?? 'git stash failed.',
        metadata: { ...metadata, label },
      };
    }
    const content: JsonObject =
      action === 'pop'
        ? { popped: true, label, note: 'the shelved work is back in the working tree.' }
        : { dropped: true, label, note: 'the shelved work is gone.' };
    return {
      content,
      metadata: { ...metadata, label },
      display: { summary: action === 'pop' ? 'popped — the shelved work is back' : 'dropped' },
    };
  },
};
