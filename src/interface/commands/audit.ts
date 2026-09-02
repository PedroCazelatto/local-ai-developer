// /audit [n] — the last N tool calls, one line each. Default 20; a bigger number is NOT capped,
// because it is the user's own scrollback and copyability is the point.
//
// The audit log is described as the only safety net for autonomous, no-confirmation tool calls, and
// until now there was no way to look at it from inside the app — the one record of what an unattended
// batch actually did lived in a file you had to quit the session to read.
//
// A USER command, and pointedly not a tool: a phase does not get to read the audit log at all
// (backlog/inspection-commands.md). A window that could read the record of its own calls could also
// reason about how they look to the user, and the log's only job is to be a record the user trusts.
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// show-audit.ts reads the log tail and prints it, over read-audit-rows.ts and format-audit-row.ts.

import type { Command } from '../command.type.js';
import { showAudit } from './show-audit.js';

export const auditCommand: Command = {
  name: 'audit',
  group: 'session',
  description: 'Show the last N tool calls from the audit log (phase, tool, exit status, duration)',
  usage: '/audit [<row count>]',
  // showAudit: the last N intact rows of tool_audit.jsonl as a padded table, oldest first, with a
  // recoverable line for a bad count, an absent log, or rows that would not parse.
  run: (ctx) => showAudit(ctx.args, ctx.orch),
};
