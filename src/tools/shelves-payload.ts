// The model's shelves as JSON it can read back — and the `available` list a bad-label error carries.
//
// It goes through listShelves, which filters `git stash list` down to the model's own `lad-shelf:`
// entries. That filter is the whole reason git_stash exists as a tool rather than as a shell command:
// the task loop keeps its own `lad-stash:<taskId>` records of failed attempts, which Retro reads and
// the user reviews, and nothing here may ever name one of those back to the model — because a name it
// can see is a name it can pop or drop.

import { listShelves } from '../core/session/list-shelves.js';
import type { JsonValue } from './json-value.type.js';

/** The shelf list as model-facing JSON — also the `available` list on a bad-label error. */
export function shelvesPayload(projectPath: string): JsonValue[] {
  return listShelves(projectPath).map((shelf) => ({ label: shelf.label, branch: shelf.branch, when: shelf.when }));
}
