// Pins /run's selector, which is the ONE place the batch/single fork and the `all` filter are decided.
// Two of its rules are load-bearing and pull against each other, so both are pinned here:
//
//   1. `all` sweeps everything that is neither `done` nor `failed` — the skip that stops an unattended
//      batch spending the night re-failing last night's tasks;
//   2. a bare id resolves to that id whatever its status — `/run <id>` is the deliberate retry, and it
//      must still reach a task `all` has stopped picking up.
//
// Pure: a Backlog in, ids out. No filesystem, no git, no model.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Backlog } from '../../../core/session/backlog.type.js';
import type { TaskStatus } from '../../../core/session/task-status.type.js';
import type { Task } from '../../../core/session/task.type.js';
import { resolveSelector } from '../resolve-selector.js';

/** A Task with only the fields the selector reads; body/paths are inert here. */
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

/** One task of each status, in status order, so every case states only its own fact. */
function oneOfEach(): Backlog {
  return backlog(
    task('waiting', 'pending', 1),
    task('running', 'in_progress', 2),
    task('finished', 'done', 3),
    task('stuck', 'blocked', 4),
    task('burnt', 'failed', 5),
  );
}

// ------------------------------------------------------------------------------------------- all

test('all sweeps every task that is neither done nor failed', () => {
  assert.deepEqual(resolveSelector(oneOfEach(), 'all').ids, ['waiting', 'running', 'stuck']);
});

test('a FAILED task is skipped by all — the whole point of the status', () => {
  // Before the escalation record existed this task was `pending` and indistinguishable from one nobody
  // had touched, so the next `/run all` spent another five rounds on it.
  assert.deepEqual(resolveSelector(backlog(task('burnt', 'failed', 1)), 'all').ids, []);
});

test('all is a batch even when the filter leaves nothing to run', () => {
  // isBatch is a property of the SELECTOR, not of how many tasks survived the filter.
  assert.equal(resolveSelector(backlog(task('burnt', 'failed', 1)), 'all').isBatch, true);
});

test('all comes back in order, and the failed task is removed rather than moved', () => {
  const all = backlog(task('c', 'pending', 30), task('burnt', 'failed', 20), task('a', 'pending', 10));
  assert.deepEqual(resolveSelector(all, 'all').ids, ['a', 'c']);
});

test('failed and done are skipped for different reasons but identically', () => {
  const all = backlog(task('finished', 'done', 1), task('burnt', 'failed', 2), task('waiting', 'pending', 3));
  assert.deepEqual(resolveSelector(all, 'all').ids, ['waiting']);
});

// ------------------------------------------------------------------------------------------ next

test('next picks the first runnable task and is not a batch', () => {
  const selection = resolveSelector(oneOfEach(), 'next');
  assert.deepEqual(selection.ids, ['waiting']);
  assert.equal(selection.isBatch, false);
});

test('next passes over a failed task even when it sorts first', () => {
  const all = backlog(task('burnt', 'failed', 1), task('waiting', 'pending', 2));
  assert.deepEqual(resolveSelector(all, 'next').ids, ['waiting']);
});

test('next yields nothing when the only task left has failed', () => {
  assert.deepEqual(resolveSelector(backlog(task('burnt', 'failed', 1)), 'next').ids, []);
});

// -------------------------------------------------------------------------------------- a bare id

test('a FAILED task named explicitly still resolves — /run <id> is the retry', () => {
  // The asymmetry with `all` above is the feature: naming the task IS the "I fixed the spec, try
  // again" gesture, and it needs no flag to say so.
  const selection = resolveSelector(oneOfEach(), 'burnt');
  assert.deepEqual(selection.ids, ['burnt']);
  assert.equal(selection.isBatch, false);
});

test('a bare id is not checked against the backlog at all', () => {
  // The selector does not filter by status or existence — eligibility is taskSkipReason's job, one
  // layer down, which is what lets a failed id through while `all` skips it.
  assert.deepEqual(resolveSelector(backlog(), 'ghost').ids, ['ghost']);
});

test('two ids are a batch; one is not', () => {
  assert.equal(resolveSelector(oneOfEach(), 'burnt').isBatch, false);
  assert.equal(resolveSelector(oneOfEach(), 'burnt,waiting').isBatch, true);
});

test('a comma list of failed ids is honoured — the skip is `all`\'s, not every batch\'s', () => {
  // Naming ids explicitly is deliberate whether there is one of them or five, so the `all` filter
  // must not leak into the comma-list branch.
  assert.deepEqual(resolveSelector(oneOfEach(), 'burnt,finished').ids, ['burnt', 'finished']);
});

test('whitespace and empty entries around a comma list are dropped', () => {
  assert.deepEqual(resolveSelector(oneOfEach(), ' burnt , , waiting ').ids, ['burnt', 'waiting']);
});
