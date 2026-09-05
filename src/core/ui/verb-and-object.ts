// The subject of a tool call that reads as an action on a thing — `git_stash save wip-auth`,
// `git_branch create task/01-x`, `git_inspect log`. The verb is the tool's `action`/`what` argument
// and the object is whatever that action names; an action with no object is the whole subject on its
// own, which is why `log` is a complete answer.

import { cleanSubjectText } from './clean-subject-text.js';
import { NO_SUBJECT } from './no-subject.js';
import { textSubject } from './text-subject.js';
import type { ToolCallSubject } from './tool-call-subject.js';

/** `action`/`what` plus its object, when it has one: `save wip-auth`, `create task/01-x`, `log`. */
export function verbAndObject(verb: unknown, object: unknown): ToolCallSubject {
  const head = cleanSubjectText(verb);
  const tail = cleanSubjectText(object);
  if (head === '') return NO_SUBJECT;
  return textSubject(tail === '' ? head : `${head} ${tail}`);
}
