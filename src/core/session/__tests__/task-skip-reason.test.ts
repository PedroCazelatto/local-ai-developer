// Pins the single-task skip rule, the /run path's half of the dependency gate. Each reason is a
// distinct string shown to the user, so each is pinned; the unmet-dependency branch must list only
// the dependencies that are actually unmet, including one that names an id nothing in the backlog has.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Backlog } from '../backlog.type.js';
import { taskSkipReason } from '../task-skip-reason.js';
import type { TaskStatus } from '../task-status.type.js';
import type { Task } from '../task.type.js';

function task(id: string, status: TaskStatus, dependsOn: readonly string[] = []): Task {
  return {
    id,
    filePath: `/tmp/backlog/${id}.md`,
    title: id,
    body: '',
    dependsOn,
    order: 1,
    status,
    epic: null,
    story: null,
  };
}

function backlog(...tasks: readonly Task[]): Backlog {
  return { tasks };
}

// ------------------------------------------------------------------------------- the flat reasons

test('an id that is not in the backlog is itself a skip reason', () => {
  assert.equal(taskSkipReason(backlog(task('a', 'pending')), 'ghost'), 'not found in the backlog.');
});

test('a done task is skipped', () => {
  assert.equal(taskSkipReason(backlog(task('a', 'done')), 'a'), 'already done.');
});

test('a blocked task is skipped and points at /answer', () => {
  assert.equal(
    taskSkipReason(backlog(task('a', 'blocked')), 'a'),
    'blocked, awaiting your /answer (answer it, then re-run).',
  );
});

test('a pending task with nothing to wait for is runnable', () => {
  assert.equal(taskSkipReason(backlog(task('a', 'pending')), 'a'), null);
});

test('an in_progress task is NOT skipped', () => {
  // Asymmetric with nextRunnableTasks, which excludes in_progress. Pinned as the CURRENT behaviour
  // — it is what lets /run resume a task a crashed window left mid-flight. See the report.
  assert.equal(taskSkipReason(backlog(task('a', 'in_progress')), 'a'), null);
});

test('a FAILED task is NOT skipped — /run <id> retries it from scratch', () => {
  // The load-bearing half of the escalation record: this predicate guards BOTH the single-task /run
  // path and the batch's per-task check, so a refusal here would refuse the deliberate retry too.
  // `/run all` skips a failed task in resolveSelector instead, which only the batch selector reaches.
  assert.equal(taskSkipReason(backlog(task('a', 'failed')), 'a'), null);
});

test('a failed task with every dependency done is runnable', () => {
  const all = backlog(task('x', 'done'), task('a', 'failed', ['x']));
  assert.equal(taskSkipReason(all, 'a'), null);
});

test('a failed dependency is reported as unmet', () => {
  // Only `done` counts as met, so the retry gesture is per-task: naming the dependent does not
  // reopen the failure it waits on.
  const all = backlog(task('dep', 'failed'), task('a', 'pending', ['dep']));
  assert.equal(taskSkipReason(all, 'a'), 'waiting on dep (not done).');
});

// --------------------------------------------------------------------------------- dependencies

test('an unmet dependency is named', () => {
  const all = backlog(task('dep', 'pending'), task('a', 'pending', ['dep']));
  assert.equal(taskSkipReason(all, 'a'), 'waiting on dep (not done).');
});

test('a depends_on naming an id that does not exist is reported as unmet', () => {
  assert.equal(taskSkipReason(backlog(task('a', 'pending', ['ghost'])), 'a'), 'waiting on ghost (not done).');
});

test('only the unmet dependencies are listed, in depends_on order', () => {
  const all = backlog(
    task('x', 'done'),
    task('y', 'pending'),
    task('z', 'blocked'),
    task('a', 'pending', ['x', 'y', 'z']),
  );
  assert.equal(taskSkipReason(all, 'a'), 'waiting on y, z (not done).');
});

test('all dependencies done leaves the task runnable', () => {
  const all = backlog(task('x', 'done'), task('y', 'done'), task('a', 'pending', ['x', 'y']));
  assert.equal(taskSkipReason(all, 'a'), null);
});

// ----------------------------------------------------------------------------- precedence order

test('done wins over an unmet dependency', () => {
  const all = backlog(task('dep', 'pending'), task('a', 'done', ['dep']));
  assert.equal(taskSkipReason(all, 'a'), 'already done.');
});

test('blocked wins over an unmet dependency', () => {
  const all = backlog(task('dep', 'pending'), task('a', 'blocked', ['dep']));
  assert.match(taskSkipReason(all, 'a') ?? '', /^blocked,/);
});
