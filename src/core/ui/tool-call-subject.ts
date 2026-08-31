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

import { arrayCount } from './array-count.js';
import { cleanSubjectText } from './clean-subject-text.js';
import { NO_SUBJECT } from './no-subject.js';
import { pathSubject } from './path-subject.js';
import { textSubject } from './text-subject.js';
import { verbAndObject } from './verb-and-object.js';

/** The identifying argument of a tool call, plus whether it is a path (paths are never truncated). */
export interface ToolCallSubject {
  /**
   * The subject as it should read after the tool name, already stripped of control characters and
   * folded onto one line. EMPTY for a tool that takes no arguments (list_changes, git_push,
   * mark_task_done) — those are fully identified by their name alone.
   */
  readonly text: string;
  /**
   * True when `text` is a filesystem path. A path is NEVER truncated: it is the one string on the line
   * whose tail carries the meaning, and a cut path is worse than a wrapped row. Everything else — a
   * command, a search pattern, a prose claim — goes through truncateToWidth as usual.
   */
  readonly isPath: boolean;
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
      return pathSubject(args['path']);
    case 'list_files': {
      const path = cleanSubjectText(args['path']);
      return { text: path === '' ? '.' : path, isPath: true };
    }
    case 'search_in_files': {
      const pattern = cleanSubjectText(args['pattern']);
      if (pattern === '') return NO_SUBJECT;
      const glob = cleanSubjectText(args['glob']);
      return textSubject(glob === '' ? `"${pattern}"` : `"${pattern}" in ${glob}`);
    }

    // ----------------------------------------------------------------------------- shell + container
    case 'execute_command':
    case 'run_in_project':
      return textSubject(cleanSubjectText(args['command']));

    // ---------------------------------------------------------------------------------- project git
    case 'list_changes':
    case 'git_push':
      return NO_SUBJECT; // both take no arguments at all
    case 'commit_changes': {
      // One path IS the subject; several are not, and listing them would be the unbounded dump this
      // record exists to avoid. `intent` is prose and never the subject.
      const paths = args['paths'];
      if (!Array.isArray(paths) || paths.length === 0) return NO_SUBJECT;
      return paths.length === 1 ? pathSubject(paths[0]) : textSubject(`${paths.length} paths`);
    }
    case 'git_stash':
      return verbAndObject(args['action'], args['label']);
    case 'git_branch':
      return verbAndObject(args['action'], args['name']);
    case 'git_inspect':
      return verbAndObject(args['what'], args['ref']);

    // ----------------------------------------------------------------------------------- the inbox
    case 'inbox_read': {
      const status = cleanSubjectText(args['status']);
      return textSubject(status === '' ? 'open' : status);
    }
    case 'inbox_post':
      return textSubject(cleanSubjectText(args['to'])); // the recipient phase, never the body
    case 'inbox_resolve':
      return textSubject(cleanSubjectText(args['id']));

    // ------------------------------------------------------------------------------------- standards
    case 'search_rules':
      return textSubject(cleanSubjectText(args['intent'])); // prose fallback — search_rules has nothing else
    case 'load_rule':
      return textSubject(cleanSubjectText(args['name']));

    // ------------------------------------------------------------------------------------ sub-agents
    case 'spawn_subagent':
      return textSubject(cleanSubjectText(args['task'])); // prose fallback — initial_context is longer still
    case 'ask_subagent':
    case 'dismiss_subagent':
      return textSubject(cleanSubjectText(args['id']));

    // ------------------------------------------------------------------- deliberation + questioning
    case 'debate':
      return textSubject(cleanSubjectText(args['claim'])); // prose fallback — the claim IS the call
    case 'ask_user': {
      const count = arrayCount(args['questions']);
      return count === 0 ? NO_SUBJECT : textSubject(`${count} question${count === 1 ? '' : 's'}`);
    }

    // ------------------------------------------------------------------------ phase-scoped exits
    case 'submit_verdict':
      return textSubject(cleanSubjectText(args['result'])); // pass | fail — never the summary prose
    case 'raise_blocker':
      return textSubject(cleanSubjectText(args['question'])); // prose fallback — the question IS the call
    case 'mark_task_done':
      return NO_SUBJECT; // takes no arguments: it always means the task under review
    case 'submit_retro':
      return textSubject(cleanSubjectText(args['scope'])); // systemic | task-specific — never the rootCause prose
    case 'read_phase_rule':
    case 'edit_phase_rule':
      return textSubject(cleanSubjectText(args['phase'])); // a phase NAME, not a path — rules/phases/<phase>.md is implied

    default:
      return NO_SUBJECT;
  }
}
