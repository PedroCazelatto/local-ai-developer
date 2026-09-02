// Look before you write — the precondition edit_file and write_file share for a file that ALREADY
// EXISTS. The window must have read the file, and the file must still hold the bytes it read.
//
// Only ever called for an existing file. Creating a new one is not gated and must not be: there is
// nothing to have read, and refusing a create would break scaffolding (write_file drops
// `src/foo/bar.ts` into an empty project — see rules/phases/breakdown.md).
//
// Why a mechanical guard rather than an instruction in the prompt: a local model is more often
// confidently-wrong than self-aware — the stated reason the Reviewer is the sole gatekeeper — and an
// edit reasoned from a file the model never opened is the cheapest of all mistakes to make and the
// most expensive to notice. The rule is enforced where it cannot be talked out of, and it is why the
// phase prompts can now tell the Worker NOT to re-read a file to verify its own edit: the harness
// knows what the window has seen, so the model does not have to check.

import type { FileReadTracker } from '../core/session/read-tracker.type.js';

/**
 * The guard's answer. A refusal carries BOTH halves the model needs: what is wrong, and which of
 * the two fixes applies — the whole point of the guard is that "read it first" and "read it again"
 * are different instructions.
 */
export type GuardWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string; readonly hint: string };

/**
 * Decide whether this window may change `path`, whose current bytes are `current`.
 *
 * `path` is the model's own path string and is used only for the messages — the caller has already
 * scoped it. `tracker.status` answers `unread` / `stale` / `current` by comparing the hash the window
 * recorded at read time against the bytes the caller is holding right now.
 */
export function guardWriteTarget(tracker: FileReadTracker, path: string, current: Uint8Array): GuardWriteResult {
  const status = tracker.status(path, current);
  if (status === 'current') {
    return { ok: true };
  }
  if (status === 'unread') {
    return {
      ok: false,
      error: `You have not read '${path}' in this session, so you cannot change it yet.`,
      hint: `Call read_file with path: '${path}' first, then make the change against what it actually says.`,
    };
  }
  return {
    ok: false,
    error: `'${path}' has changed since you read it — your copy is out of date.`,
    hint: `Call read_file with path: '${path}' again, then re-apply your change to the current contents.`,
  };
}
