// Which argument names what a tool call did — the left half of the scrollback record.
//
// `→ read_file src/core/ui/theme.ts`, not a JSON dump of the arguments object, which would be
// unreadable and unbounded. One field per tool, chosen per tool, by one rule:
//
//   Prefer the SHORT STRUCTURAL field when the tool has one, and fall back to prose only when it has
//   none. That is why inbox_post shows its recipient rather than its body, submit_verdict shows
//   pass/fail rather than its summary, and ask_subagent shows the id rather than the message — the
//   structural field is what tells two adjacent calls apart, and the prose never fits anyway. Only
//   debate, spawn_subagent, raise_blocker and search_rules have nothing else to show, so those four
//   fall back to their prose field, folded onto one line and truncated by the formatter.
//
// This file tracks the tools' ARGUMENT NAMES. A tool that renames a parameter has to be followed here,
// or its calls quietly go anonymous — which is exactly the state this whole record exists to end.
// Nothing here throws or validates: an argument of the wrong type simply yields an empty subject, and
// the dispatcher is what turns a bad call into an error the model can read.

import { singleLine } from './single-line.js';
import { stripControlChars } from './strip-control-chars.js';
import type { ToolCallSubject } from './tool-call-subject.type.js';

/** Nothing to show — the tool name alone identifies the call (list_changes, git_push, …). */
const NONE: ToolCallSubject = { text: '', isPath: false };

/** A model-supplied string, folded to one row and stripped of anything that could move the cursor. */
function text(value: unknown): string {
  return typeof value === 'string' ? stripControlChars(singleLine(value)).trim() : '';
}

/** A subject that must survive at full length whatever the terminal width is. */
function asPath(value: unknown): ToolCallSubject {
  const path = text(value);
  return path === '' ? NONE : { text: path, isPath: true };
}

/** A subject that may be truncated to fit the row. */
function asText(value: string): ToolCallSubject {
  return value === '' ? NONE : { text: value, isPath: false };
}

/** `action`/`what` plus its object, when it has one: `save wip-auth`, `create task/01-x`, `log`. */
function verbAndObject(verb: unknown, object: unknown): ToolCallSubject {
  const head = text(verb);
  const tail = text(object);
  if (head === '') return NONE;
  return asText(tail === '' ? head : `${head} ${tail}`);
}

/** How many entries an array argument holds; 0 when it is not an array. */
function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * The identifying argument of one tool call. Unknown tool names return an empty subject rather than
 * throwing — the dispatcher already answers an unknown tool with a recoverable error, and the record
 * of that attempt should still print.
 */
export function toolCallSubject(name: string, args: Record<string, unknown>): ToolCallSubject {
  switch (name) {
    // ------------------------------------------------------------------------------- the file tools
    case 'read_file':
    case 'write_file':
    case 'edit_file':
      return asPath(args['path']);
    case 'list_files': {
      const path = text(args['path']);
      return { text: path === '' ? '.' : path, isPath: true };
    }
    case 'search_in_files': {
      const pattern = text(args['pattern']);
      if (pattern === '') return NONE;
      const glob = text(args['glob']);
      return asText(glob === '' ? `"${pattern}"` : `"${pattern}" in ${glob}`);
    }

    // ----------------------------------------------------------------------------- shell + container
    case 'execute_command':
    case 'run_in_project':
      return asText(text(args['command']));

    // ---------------------------------------------------------------------------------- project git
    case 'list_changes':
    case 'git_push':
      return NONE; // both take no arguments at all
    case 'commit_changes': {
      // One path IS the subject; several are not, and listing them would be the unbounded dump this
      // record exists to avoid. `intent` is prose and never the subject.
      const paths = args['paths'];
      if (!Array.isArray(paths) || paths.length === 0) return NONE;
      return paths.length === 1 ? asPath(paths[0]) : asText(`${paths.length} paths`);
    }
    case 'git_stash':
      return verbAndObject(args['action'], args['label']);
    case 'git_branch':
      return verbAndObject(args['action'], args['name']);
    case 'git_inspect':
      return verbAndObject(args['what'], args['ref']);

    // ----------------------------------------------------------------------------------- the inbox
    case 'inbox_read': {
      const status = text(args['status']);
      return asText(status === '' ? 'open' : status);
    }
    case 'inbox_post':
      return asText(text(args['to'])); // the recipient phase, never the body
    case 'inbox_resolve':
      return asText(text(args['id']));

    // ------------------------------------------------------------------------------------- standards
    case 'search_rules':
      return asText(text(args['intent'])); // prose fallback — search_rules has nothing else
    case 'load_rule':
      return asText(text(args['name']));

    // ------------------------------------------------------------------------------------ sub-agents
    case 'spawn_subagent':
      return asText(text(args['task'])); // prose fallback — initial_context is longer still
    case 'ask_subagent':
    case 'dismiss_subagent':
      return asText(text(args['id']));

    // ------------------------------------------------------------------- deliberation + questioning
    case 'debate':
      return asText(text(args['claim'])); // prose fallback — the claim IS the call
    case 'ask_user': {
      const count = countOf(args['questions']);
      return count === 0 ? NONE : asText(`${count} question${count === 1 ? '' : 's'}`);
    }

    // ------------------------------------------------------------------------ phase-scoped exits
    case 'submit_verdict':
      return asText(text(args['result'])); // pass | fail — never the summary prose
    case 'raise_blocker':
      return asText(text(args['question'])); // prose fallback — the question IS the call
    case 'mark_task_done':
      return NONE; // takes no arguments: it always means the task under review
    case 'submit_retro':
      return asText(text(args['scope'])); // systemic | task-specific — never the rootCause prose
    case 'read_phase_rule':
    case 'edit_phase_rule':
      return asText(text(args['phase'])); // a phase NAME, not a path — rules/phases/<phase>.md is implied

    default:
      return NONE;
  }
}
