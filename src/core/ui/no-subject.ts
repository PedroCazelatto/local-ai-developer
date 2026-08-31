// The empty tool-call subject, shared by every file that builds one.
//
// A value rather than a fresh literal at each site, for the reason tar-format.ts holds the ustar field
// widths: one shape, one home, so the two cannot drift apart. Tools that take no arguments at all
// (list_changes, git_push, mark_task_done) are fully identified by their name, and so is a call whose
// identifying argument came back the wrong type — nothing here throws, an unusable argument simply
// yields this.

import type { ToolCallSubject } from './tool-call-subject.js';

/** Nothing to show — the tool name alone identifies the call (list_changes, git_push, …). */
export const NO_SUBJECT: ToolCallSubject = { text: '', isPath: false };
