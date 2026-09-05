// Pins the dependency gate that decides what the batch driver is allowed to start. The case that
// matters most is the one a re-implementation drops: a depends_on naming an id that is NOT in the
// backlog counts as UNMET, so a typo in a dependency can never open a task up rather than close it.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Backlog } from '../backlog.type.js';
import { nextRunnableTasks } from '../next-runnable-tasks.js';
import type { TaskStatus } from '../task-status.type.js';
import type { Task } from '../task.type.js';

/** A Task with only the fields the gate reads; body/paths are inert here. */
function task(id: string, status: TaskStatus, order: number, dependsOn: readonly string[] = []): Task {
  return {
    id,
    filePath: `/tmp/backlog/${id}.md`,
    title: id,
    body: '',
    dependsOn,
    order,
    status,
    epic: null,
    story: null,
  };
}

function backlog(...tasks: readonly Task[]): Backlog {
  return { tasks };
}

/** Ids only — the gate's answer is a set of tasks, and order within it is asserted separately. */
function ids(tasks: readonly Task[]): string[] {
  return tasks.map((t) => t.id);
}

// ------------------------------------------------------------------------------ status filtering

test('only pending tasks are runnable', () => {
  const all = backlog(
    task('pending', 'pending', 1),
    task('running', 'in_progress', 2),
    task('finished', 'done', 3),
    task('stuck', 'blocked', 4),
  );
  assert.deepEqual(ids(nextRunnableTasks(all)), ['pending']);
});

test('a backlog with nothing pending yields nothing', () => {
  assert.deepEqual(ids(nextRunnableTasks(backlog(task('a', 'done', 1)))), []);
});

test('an empty backlog yields nothing', () => {
  assert.deepEqual(ids(nextRunnableTasks(backlog())), []);
});

// --------------------------------------------------------------------------------- dependencies

test('a task with no dependencies is runnable', () => {
  assert.deepEqual(ids(nextRunnableTasks(backlog(task('a', 'pending', 1)))), ['a']);
});

test('every dependency must be done, not merely present', () => {
  const all = backlog(task('dep', 'pending', 1), task('a', 'pending', 2, ['dep']));
  assert.deepEqual(ids(nextRunnableTasks(all)), ['dep']);
});

test('a dependency that is in_progress does not count as met', () => {
  const all = backlog(task('dep', 'in_progress', 1), task('a', 'pending', 2, ['dep']));
  assert.deepEqual(ids(nextRunnableTasks(all)), []);
});

test('a task opens up once all of its dependencies are done', () => {
  const all = backlog(task('x', 'done', 1), task('y', 'done', 2), task('a', 'pending', 3, ['x', 'y']));
  assert.deepEqual(ids(nextRunnableTasks(all)), ['a']);
});

test('one unmet dependency among several is enough to hold a task back', () => {
  const all = backlog(task('x', 'done', 1), task('y', 'pending', 2), task('a', 'pending', 3, ['x', 'y']));
  assert.deepEqual(ids(nextRunnableTasks(all)), ['y']);
});

test('a depends_on naming an id that does not exist counts as UNMET', () => {
  // Defense in depth: an unresolvable dependency must never be read as "nothing to wait for".
  const all = backlog(task('a', 'pending', 1, ['no-such-task']));
  assert.deepEqual(ids(nextRunnableTasks(all)), []);
});

test('a task depending on itself can never run', () => {
  assert.deepEqual(ids(nextRunnableTasks(backlog(task('a', 'pending', 1, ['a'])))), []);
});

// ---------------------------------------------------------------------------------------- order

test('the runnable set comes back sorted by order, not by backlog position', () => {
  const all = backlog(task('third', 'pending', 30), task('first', 'pending', 10), task('second', 'pending', 20));
  assert.deepEqual(ids(nextRunnableTasks(all)), ['first', 'second', 'third']);
});

test('the source backlog is not reordered in place', () => {
  const all = backlog(task('b', 'pending', 20), task('a', 'pending', 10));
  nextRunnableTasks(all);
  assert.deepEqual(ids(all.tasks), ['b', 'a']);
});
