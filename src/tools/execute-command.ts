// execute_command (V1/04) — plain shell (ls, cat, mv, mkdir, piping) inside the ROOT SANDBOX at
// /workspace. The real boundary is the Docker mount: only the active project is mounted at
// /workspace, so `..` / `$(...)` / symlinks land in the empty container OS, never in another
// project or on the host. The `..` guard below is a COURTESY — it hands a confused model a clean
// recoverable error instead of letting it wander — not the security control. NOT for language
// toolchains (npm/pip/pytest/cargo): the root sandbox is a slim base; those go to run_in_project.

import { WORKSPACE_PATH } from './context.js';
import type { JsonObject } from './json-object.type.js';
import type { ToolModule } from './tool-module.type.js';
import type { ToolResult } from './tool-result.type.js';
import { truncateHeadTail } from './truncate.js';

// Ported from tools/execute_command.py: an obvious `..` escape anywhere the command could form a
// path. Not a full shell parse (impossible + unnecessary — the mount is the real boundary).
const TRAVERSAL_TOKEN = /(?:^|[\s'"=:])\.\.(?:[/\\]|$|[\s'"])/;
const TRAVERSAL_IN_PATH = /[/\\]\.\.(?:[/\\]|$|[\s'"])/;

function looksLikeEscape(command: string): boolean {
  return TRAVERSAL_TOKEN.test(command) || TRAVERSAL_IN_PATH.test(command);
}

export const executeCommandTool: ToolModule = {
  name: 'execute_command',
  description:
    'Run a plain shell command (ls, cat, mv, mkdir, piping) in the active project at /workspace inside the sandbox. Paths are relative to the project root. NOT for language toolchains (tests, builds, npm/pip) — use run_in_project for those.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to run at /workspace.' },
    },
    required: ['command'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const metadata: JsonObject = { workdir: WORKSPACE_PATH, project: ctx.projectName };
    const command = args['command'];
    if (typeof command !== 'string') {
      return { content: { error: "'command' must be a string." }, exitStatus: -1, error: "'command' must be a string.", metadata };
    }
    if (looksLikeEscape(command)) {
      const error = "Command appears to escape /workspace (found '..'). Use paths relative to the project root.";
      return {
        content: { error, hint: 'Everything you need is under /workspace.' },
        exitStatus: -1,
        error,
        metadata,
      };
    }

    // Run in the root sandbox at /workspace. sandbox.exec is recoverable — a daemon/container
    // problem comes back as a non-zero ExecResult with the message in stderr, never a throw.
    const result = await ctx.sandbox.exec(command, { workdir: WORKSPACE_PATH });
    const combined = truncateHeadTail(`STDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
    // Success returns the output string EVEN on a non-zero shell exit (the model needs the error
    // text); the audit row keeps the REAL exit code.
    // The exit code IS the result here, so it is the whole summary; the printer adds the elapsed time,
    // which for a shell command is the other half of what you wanted to know.
    return { content: combined, exitStatus: result.exitCode, metadata, display: { summary: `exit ${result.exitCode}` } };
  },
};
