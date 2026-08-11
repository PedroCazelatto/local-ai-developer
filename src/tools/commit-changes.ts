// commit_changes — the model's only route into the project's git history. Host-side (the root sandbox
// ships no git), staging EXACTLY the paths the phase names — never `git add -A`, so a commit can never
// sweep in a file nobody looked at. The message is NOT written by the caller: composeCommitMessage
// hands the real diff to a throwaway one-shot context which writes it (backlog: per-phase commits).
//
// Available to every phase EXCEPT the Worker: a Worker that could commit its own code would be its own
// gatekeeper, so it hands everything to the Reviewer, which commits what it accepts and returns the
// rest with notes (worker-runner refuses this tool; reviewer-runner allows it).
//
// commitPaths refuses any path escaping the project repo — the guard that keeps a global instruction
// edit (the orchestrator's own rules/, which lives outside every project) from ever being committed
// by a model.

import { commitPaths, diffPaths, listChangedPaths } from '../core/session/project-git.js';
import { composeCommitMessage } from './compose-commit-message.js';
import type { JsonObject, ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

export const COMMIT_CHANGES = 'commit_changes';

/** git speaks forward slashes on every platform; accept whatever separator the model emitted. */
function toPosix(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** True when `path` is itself a changed file, or a directory containing one. */
function matchesChange(path: string, changed: readonly string[]): boolean {
  return changed.includes(path) || changed.some((file) => file.startsWith(`${path}/`));
}

/** Validate the `paths` argument into a clean posix list, or return the model-facing reason it isn't one. */
function readPaths(raw: unknown): { readonly ok: true; readonly paths: string[] } | { readonly ok: false; readonly error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "'paths' must be a non-empty array of project-relative file paths." };
  }
  const paths: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      return { ok: false, error: "every entry in 'paths' must be a non-empty string." };
    }
    const normalized = toPosix(entry.trim());
    if (normalized !== '' && !paths.includes(normalized)) paths.push(normalized);
  }
  return paths.length === 0 ? { ok: false, error: "'paths' contained no usable path." } : { ok: true, paths };
}

export const commitChangesTool: ToolModule = {
  name: COMMIT_CHANGES,
  description:
    'Commit finished work to the project repo. Stages EXACTLY the paths you list — nothing else — and ' +
    'writes the commit message for you from the real diff, so describe only WHY in `intent`. Keep every ' +
    'commit as small as it can be without breaking the project: commit one coherent change at a time ' +
    'rather than the whole working tree at once, and call it as soon as a piece of work is complete. ' +
    'Call list_changes first to see what is uncommitted.',
  parameters: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Project-relative paths to commit, e.g. ["src/auth/hash.ts", "tests/hash.test.ts"]. Every path ' +
          'must be an uncommitted change from list_changes. A directory commits the changed files under it.',
      },
      intent: {
        type: 'string',
        description:
          'One line: WHY this change was made (the reason, not a file list). It is context for the ' +
          'message writer, which reads the actual diff — it is not used as the message verbatim.',
      },
    },
    required: ['paths', 'intent'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const metadata: JsonObject = { project: ctx.projectName };

    const parsed = readPaths(args['paths']);
    if (!parsed.ok) {
      return toolError(parsed.error, 'Call list_changes to see the exact paths you can commit.');
    }
    const intent = args['intent'];
    if (typeof intent !== 'string' || intent.trim() === '') {
      return toolError("'intent' must be a non-empty string.", 'State in one line why this change was made.');
    }

    // Path scoping, twice over: ctx.resolve rejects an escape here with a message the model can act on,
    // and commitPaths refuses it again at staging time (defense in depth — the second guard is the one
    // that keeps a rules/ edit out of a project commit even if this one is ever loosened).
    for (const path of parsed.paths) {
      try {
        ctx.resolve(path);
      } catch {
        return toolError(
          `'${path}' is outside the project — refusing to commit it.`,
          'Commit only files inside the project you are working on.',
        );
      }
    }

    // Every named path must actually be uncommitted, so a mistyped path fails loudly here instead of
    // producing an empty commit (or, worse, a commit the phase believes contains a file it does not).
    const changed = listChangedPaths(ctx.projectPath).files.map(toPosix);
    const missing = parsed.paths.filter((path) => !matchesChange(path, changed));
    if (missing.length > 0) {
      return toolError(
        `nothing to commit for: ${missing.join(', ')} — ${changed.length === 0 ? 'the working tree is clean.' : 'not an uncommitted change.'}`,
        'Call list_changes and commit only paths it reports.',
      );
    }

    // diffPaths: the REAL diff of exactly these paths (tracked edits + new-file bodies), bounded so a
    // huge change can't blow past num_ctx in the message writer's throwaway context.
    const diff = diffPaths(ctx.projectPath, parsed.paths);
    // composeCommitMessage: a fresh, history-free one-shot writes the message from that diff — the
    // committing phase never writes its own message, and this never enters its context.
    const message = await composeCommitMessage({
      oneShot: ctx.oneShot,
      diff,
      intent: intent.trim(),
      paths: parsed.paths,
    });

    // commitPaths: stages ONLY these paths (never `git add -A`) and refuses any that escape the repo.
    const commit = commitPaths(ctx.projectPath, message, parsed.paths);
    if (!commit.committed) {
      return {
        content: { error: commit.error ?? 'git commit failed.', hint: 'Call list_changes to re-check the working tree.' },
        exitStatus: -1,
        error: commit.error ?? 'git commit failed.',
        metadata,
      };
    }

    const remaining = listChangedPaths(ctx.projectPath).files;
    const content: JsonObject = {
      committed: true,
      sha: commit.sha ?? null,
      files: commit.files,
      message,
      remaining_uncommitted: remaining,
    };
    return {
      content,
      exitStatus: 0,
      metadata: { ...metadata, sha: commit.sha ?? null, files: commit.files, remaining: remaining.length },
      // The sha and the file count: what landed, and how much of it. The paths are already on the
      // `→` line (one of them) or would be the unbounded dump this record exists to avoid (several).
      display: {
        summary: `${commit.sha ?? 'committed'} · ${commit.files.length} file${commit.files.length === 1 ? '' : 's'}`,
      },
    };
  },
};
