// search_in_files (V1/03) — ported from tools/search_in_files.py. Literal, CASE-SENSITIVE substring
// search over UTF-8 text files under the project root. Skips the heavy/generated dirs (crucially
// node_modules/dist/build for TS projects, or a post-`npm i` search blows the match cap and the
// token budget). Optional filename glob. Output lines are `<relative>:<lineno>: <line>` with
// forward-slash paths regardless of host OS. Capped at 200 matches.

import { readdirSync, readFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';

import { decodeUtf8Strict, globToRegExp } from './fs-support.js';
import type { ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

const MAX_MATCHES = 200;
const SKIP_DIRS = new Set(['.git', '__pycache__', 'node_modules', '.venv', 'venv', 'dist', 'build']);

/** Yield every regular file under `dir`, skipping the generated/vendored directories. */
function* walkFiles(dir: string): Generator<string> {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory — skip silently (matches the Python OSError tolerance)
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walkFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

export const searchInFilesTool: ToolModule = {
  name: 'search_in_files',
  description:
    "Search for a literal substring across text files in the project (case-sensitive). Returns matching file paths with line numbers and line text. Optionally filter by a filename glob (e.g. '*.ts').",
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Literal substring to search for (case-sensitive).' },
      glob: {
        type: 'string',
        description: "Optional filename glob to filter files (e.g. '*.ts'). Defaults to all files.",
      },
    },
    required: ['pattern'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const pattern = args['pattern'];
    const glob = args['glob'];
    if (typeof pattern !== 'string' || pattern === '') {
      return toolError("'pattern' must be a non-empty string.");
    }
    if (glob !== undefined && typeof glob !== 'string') {
      return toolError("'glob' must be a string if provided.");
    }
    let root: string;
    try {
      root = ctx.resolve('.');
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }

    const globRe = glob !== undefined ? globToRegExp(glob) : null;
    const matches: string[] = [];
    for (const full of walkFiles(root)) {
      const name = path.basename(full);
      if (globRe !== null && !globRe.test(name)) continue;
      let text: string;
      try {
        text = decodeUtf8Strict(readFileSync(full));
      } catch {
        continue; // binary / unreadable — skipped silently
      }
      const relative = path.relative(root, full).split(path.sep).join('/');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        if (line.includes(pattern)) {
          matches.push(`${relative}:${i + 1}: ${line.replace(/\s+$/, '')}`);
          if (matches.length >= MAX_MATCHES) {
            matches.push(`... truncated at ${MAX_MATCHES} matches.`);
            return matches.join('\n');
          }
        }
      }
    }
    if (matches.length === 0) {
      return `No matches for '${pattern}'.`;
    }
    return matches.join('\n');
  },
};
