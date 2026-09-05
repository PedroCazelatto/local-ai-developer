// git_inspect — read-only history: diff / log / show. Host-side like every git tool (the root sandbox
// ships no git). Nothing here mutates the repo.
//
// Every answer is BOUNDED. `diff` and `show` truncate head+tail at the same budget the Reviewer's own
// diff uses, and `log` is capped by commit count on top of that, because an unbounded answer would
// quietly consume the num_ctx the whole session is sized around. The model can narrow those limits
// with `count`; it cannot raise them.
//
// This is the one git tool EVERY phase gets, the Worker included: reading history cannot damage
// anything, and a Worker that can see how a file got the way it is writes a better change.

import { inspectDiff } from '../core/session/inspect-diff.js';
import { DEFAULT_LOG_COUNT } from '../core/session/inspect-log-count.js';
import { inspectLog } from '../core/session/inspect-log.js';
import { inspectShow } from '../core/session/inspect-show.js';
import { refError } from '../core/session/ref-error.js';
import type { JsonObject } from './json-object.type.js';
import { toolError } from './tool-error.js';
import type { ToolModule } from './tool-module.type.js';
import type { ToolResult } from './tool-result.type.js';

export const GIT_INSPECT = 'git_inspect';

const WHATS = ['diff', 'log', 'show'] as const;
type InspectWhat = (typeof WHATS)[number];

function isWhat(value: unknown): value is InspectWhat {
  return typeof value === 'string' && (WHATS as readonly string[]).includes(value);
}

/** git speaks forward slashes on every platform; accept whatever separator the model emitted. */
function toPosix(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** Validate `paths` into a clean posix list, or return the model-facing reason it isn't one. */
function readPaths(raw: unknown): { readonly ok: true; readonly paths: string[] } | { readonly ok: false; readonly error: string } {
  if (raw === undefined || raw === null) return { ok: true, paths: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "'paths' must be an array of project-relative file paths." };
  const paths: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      return { ok: false, error: "every entry in 'paths' must be a non-empty string." };
    }
    const normalized = toPosix(entry.trim());
    if (normalized !== '' && !paths.includes(normalized)) paths.push(normalized);
  }
  return { ok: true, paths };
}

export const gitInspectTool: ToolModule = {
  name: GIT_INSPECT,
  description:
    'Read the project\'s git history. `diff` shows uncommitted changes (optionally against a given ' +
    'commit, optionally narrowed to paths); `log` lists recent commits, one line each; `show` prints ' +
    'one commit in full with its patch. Read-only — it never changes the repo. Output is capped, so ask ' +
    'for what you need: narrow a diff with `paths`, and keep `count` small on a log.',
  parameters: {
    type: 'object',
    properties: {
      what: {
        type: 'string',
        description: 'One of "diff", "log", "show".',
      },
      ref: {
        type: 'string',
        description:
          'A commit or branch. Required for "show". For "diff" it is what to compare the working tree ' +
          'against (default HEAD); for "log" it is where to start the walk (default the current branch).',
      },
      paths: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Project-relative paths to narrow the result to, e.g. ["src/auth/hash.ts"]. Applies to ' +
          '"diff" and "log"; ignored by "show".',
      },
      count: {
        type: 'number',
        description: `How many commits "log" returns (default ${DEFAULT_LOG_COUNT}). Ignored by the others.`,
        default: DEFAULT_LOG_COUNT,
      },
    },
    required: ['what'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const what = args['what'];
    if (!isWhat(what)) {
      return toolError(`'what' must be one of: ${WHATS.join(', ')}.`);
    }

    const rawRef = args['ref'];
    if (rawRef !== undefined && typeof rawRef !== 'string') {
      return toolError("'ref' must be a string.");
    }
    const ref = typeof rawRef === 'string' && rawRef.trim() !== '' ? rawRef.trim() : null;
    if (ref !== null) {
      // refError rejects a leading '-', which git's argv would otherwise read as an OPTION — the one
      // way a read-only tool could stop being read-only.
      const bad = refError(ref);
      if (bad !== null) return toolError(bad);
    }

    const parsed = readPaths(args['paths']);
    if (!parsed.ok) return toolError(parsed.error);
    // Path scoping: ctx.resolve rejects anything escaping the project root, so an inspection can never
    // be aimed at the orchestrator's own files.
    for (const path of parsed.paths) {
      try {
        ctx.resolve(path);
      } catch {
        return toolError(
          `'${path}' is outside the project — refusing to inspect it.`,
          'Inspect only files inside the project you are working on.',
        );
      }
    }

    const metadata: JsonObject = { project: ctx.projectName, what };

    if (what === 'show' && ref === null) {
      return toolError("'ref' is required for what:\"show\".", 'Name the commit, e.g. ref:"HEAD" or a short sha.');
    }

    const result = (() => {
      if (what === 'diff') return inspectDiff(ctx.projectPath, ref, parsed.paths);
      if (what === 'show') return inspectShow(ctx.projectPath, ref ?? 'HEAD');
      const rawCount = args['count'];
      if (rawCount !== undefined && (typeof rawCount !== 'number' || !Number.isFinite(rawCount))) {
        return null; // reported below — keeps the count check next to the only action that uses it
      }
      // inspectLog clamps count into [1, MAX_LOG_COUNT] itself; the model cannot widen the cap.
      return inspectLog(ctx.projectPath, ref, parsed.paths, typeof rawCount === 'number' ? rawCount : DEFAULT_LOG_COUNT);
    })();

    if (result === null) return toolError("'count' must be a number.");
    if (!result.ok) {
      return {
        content: { error: result.error ?? 'git failed.' },
        exitStatus: -1,
        error: result.error ?? 'git failed.',
        metadata,
      };
    }

    const content: JsonObject = {
      what,
      output: result.output,
      empty: result.output === '',
      truncated: result.truncated,
    };
    // Lines rather than characters: git output is read by the row, and "cut" is said out loud so a
    // capped diff is never mistaken for the whole of one.
    const lines = result.output === '' ? 0 : result.output.split('\n').length;
    const summary = result.output === '' ? 'empty' : `${lines} line${lines === 1 ? '' : 's'}${result.truncated ? ' (cut at the cap)' : ''}`;
    return {
      content,
      metadata: { ...metadata, truncated: result.truncated, chars: result.output.length },
      display: { summary },
    };
  },
};
