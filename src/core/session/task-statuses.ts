// The task statuses as a runtime list, for validating what a model wrote into frontmatter and for
// naming the legal values back to it in the error. A value, so it is a module rather than a .type.ts.

import type { TaskStatus } from './task-status.type.js';

export const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'done', 'blocked'];
