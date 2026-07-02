// read_file — the SINGLE Foundation tool, wired to prove the turn loop closes end-to-end: a
// model-issued tool call runs INSIDE the sandbox at /workspace and its result is fed back. The
// full tool registry (discovery, many tools, audit log) is V1; this is one hardcoded tool.
//
// It runs `cat` inside the sandbox via SandboxClient.exec, so it reads only what is mounted at
// /workspace (the active project) — the model can never reach the host through it.

import type { SandboxClient } from '../core/container/index.js';
import type { Tool } from '../core/llm/index.js';

/** Tool definition sent to the model in the chat request. */
export const READ_FILE_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read a UTF-8 text file from the project (path relative to the project root) and return its contents.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the project root, e.g. "README.md".' },
      },
      required: ['path'],
    },
  },
};

/** Execute read_file: `cat /workspace/<path>` in the sandbox. Returns a structured error string on failure. */
export async function readFile(sandbox: SandboxClient, args: Record<string, unknown>): Promise<string> {
  const path = args['path'];
  if (typeof path !== 'string' || path.trim() === '') {
    return "Error: 'path' must be a non-empty string.";
  }
  // Keep it project-relative; the sandbox mount is the real boundary, this is just the contract.
  if (path.startsWith('/')) {
    return "Error: 'path' must be relative to the project root, not absolute.";
  }
  const result = await sandbox.exec(`cat -- ${shellSingleQuote(`/workspace/${path}`)}`);
  if (result.exitCode !== 0) {
    return `Error reading '${path}': ${result.stderr.trim() || `exit ${result.exitCode}`}`;
  }
  return result.stdout;
}

/** Single-quote a string for POSIX sh so a model-supplied path can't break out of the command. */
function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
