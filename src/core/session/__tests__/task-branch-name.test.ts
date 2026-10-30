// Pins taskBranchName — the branch every actor must spell identically. The two behaviours worth
// nailing down are the ones a re-derivation would get wrong: the id is sanitized into ref-legal
// segments, and the title slug is appended ONLY when the id's leaf does not already end with it.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { taskBranchName } from '../task-branch-name.js';
import type { Task } from '../task.type.js';

/** A Task carrying only the two fields the branch name is derived from; the rest are inert. */
function task(id: string, title: string): Task {
  return {
    id,
    filePath: `/tmp/backlog/${id}.md`,
    title,
    body: '',
    dependsOn: [],
    order: 1,
    status: 'pending',
    epic: null,
    story: null,
  };
}

// ------------------------------------------------------------------------- the two normal shapes

test('a nested id maps straight through and mirrors the backlog tree', () => {
  assert.equal(
    taskBranchName(task('epic-auth/story-signup/01-add-hashing-test', 'Add hashing test')),
    'task/epic-auth/story-signup/01-add-hashing-test',
  );
});

test('the title slug is appended when the leaf does not already say it', () => {
  assert.equal(taskBranchName(task('01-foo', 'Wire the parser')), 'task/01-foo-wire-the-parser');
});

// ------------------------------------------------------------- the "leaf already ends with it" case

test('a leaf that already ends with the slug is left alone rather than repeating it', () => {
  assert.equal(taskBranchName(task('epic/01-add-hashing-test', 'Add hashing test')), 'task/epic/01-add-hashing-test');
});

test('the leaf comparison is case-insensitive but the id keeps its own casing', () => {
  assert.equal(taskBranchName(task('01-Foo', 'FOO')), 'task/01-Foo');
});

test('the leaf match is a plain suffix, not a dash-boundary match', () => {
  // '01-latest' ends with 'test', so the slug is suppressed even though the leaf never said "test".
  // Pinned as the CURRENT behaviour — see the report's discrepancy note.
  assert.equal(taskBranchName(task('01-latest', 'Test')), 'task/01-latest');
});

// -------------------------------------------------------------------------------- empty-ish titles

test('an empty title adds nothing', () => {
  assert.equal(taskBranchName(task('01-foo', '')), 'task/01-foo');
});

test('a title made only of punctuation slugs to nothing and adds nothing', () => {
  assert.equal(taskBranchName(task('01-foo', '!!! ??? ...')), 'task/01-foo');
});

// ---------------------------------------------------------------------------------- id sanitizing

test('spaces and other ref-hostile characters in a segment collapse to single dashes', () => {
  assert.equal(taskBranchName(task('my task/sub dir', 'Go')), 'task/my-task/sub-dir-go');
});

test('a run of dashes produced by sanitizing is collapsed', () => {
  assert.equal(taskBranchName(task('a-%-b', 'Go')), 'task/a-b-go');
});

test('a .lock suffix — illegal in a ref — is rewritten rather than discovered at checkout', () => {
  assert.equal(taskBranchName(task('foo.lock', 'Foo lock')), 'task/foo-lock');
});

test('leading and trailing dots and dashes are stripped from every segment', () => {
  assert.equal(taskBranchName(task('.hidden/-mid-/trail.', 'Go')), 'task/hidden/mid/trail-go');
});

test('an empty path segment is dropped', () => {
  assert.equal(taskBranchName(task('a//b', 'Go')), 'task/a/b-go');
});

test('a leading double dot inside a segment is stripped with the rest of the leading dots', () => {
  assert.equal(taskBranchName(task('feat/..x', 'Go')), 'task/feat/x-go');
});

test('an INTERIOR double dot survives, producing a name git will reject', () => {
  // CURRENT BEHAVIOUR, and a defect: `git check-ref-format refs/heads/task/a..b-go` fails, but the
  // function's header claims it strips what "git could choke on" here rather than at checkout time.
  // Only leading/trailing dots are stripped, per segment. See the report.
  assert.equal(taskBranchName(task('a..b', 'Go')), 'task/a..b-go');
});

test('non-ASCII in the id is replaced, not carried through', () => {
  assert.equal(taskBranchName(task('a日b', 'Go')), 'task/a-b-go');
});

// ------------------------------------------------------------------------------ pathological ids

test('an id that sanitizes away to nothing falls back to the title slug', () => {
  assert.equal(taskBranchName(task('...', 'Fix the thing')), 'task/fix-the-thing');
});

test('an id AND a title that both sanitize away fall back to "untitled"', () => {
  assert.equal(taskBranchName(task('...', '!!!')), 'task/untitled');
});

// --------------------------------------------------------------------------------- the slug cap

test('a wordy title is capped and never leaves a trailing dash', () => {
  // The 40-column cut lands exactly on a dash here, which is the case the trailing trim exists for.
  assert.equal(
    taskBranchName(task('01-x', 'abcd efgh ijkl mnop qrst uvwx yzab cdef ghij')),
    'task/01-x-abcd-efgh-ijkl-mnop-qrst-uvwx-yzab-cdef',
  );
});

test('the appended slug never exceeds the cap, whatever the title', () => {
  const branch = taskBranchName(task('01-x', 'z'.repeat(200)));
  const slug = branch.slice('task/01-x-'.length);
  assert.equal(slug.length, 40);
  assert.doesNotMatch(branch, /-$/);
});
