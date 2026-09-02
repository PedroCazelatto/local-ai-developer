// Pins readTaskFile's four field readers — readStatus / readOrder / readDependsOn / deriveTitle —
// each of which has a FORGIVING branch (a model omitted the field) and a FAIL-LOUD branch (a model
// wrote nonsense into it). The point of these tests is that the two must never swap: a missing
// status is a `pending` task, an unrecognised status is a BacklogError the Breakdown phase is told
// to fix. splitFrontmatter's fence handling is pinned here too, because it decides which branch
// every reader lands in.
//
// The readers are private to backlog.ts, so they are driven through readBacklog over a real fixture
// tree in the OS temp directory — no Docker, no Ollama, no terminal. When the one-function-per-file
// sweep reaches core/session and gives each reader its own file, these cases can be re-pointed at
// them directly; the assertions do not change.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { BacklogError } from '../backlog-error.js';
import type { Backlog } from '../backlog.type.js';
import { readBacklog } from '../read-backlog.js';
import { TASK_STATUSES } from '../task-statuses.js';
import type { Task } from '../task.type.js';

/** Build a throwaway project whose backlog/ holds `files` (keys are paths under backlog/), and read it. */
function readFixture(files: Readonly<Record<string, string>>): Backlog {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'lad-backlog-'));
  try {
    mkdirSync(path.join(projectRoot, 'backlog'), { recursive: true });
    for (const [rel, text] of Object.entries(files)) {
      const full = path.join(projectRoot, 'backlog', ...rel.split('/'));
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, text, 'utf-8');
    }
    return readBacklog(projectRoot);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

/** The single task a one-file fixture must produce. */
function readOne(rel: string, text: string): Task {
  const { tasks } = readFixture({ [rel]: text });
  assert.equal(tasks.length, 1, 'fixture was expected to produce exactly one task');
  const task = tasks[0];
  assert.ok(task !== undefined);
  return task;
}

/** A task file with `frontmatter` fenced above `body`. */
function withFrontmatter(frontmatter: string, body = '# Title\n'): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

// ================================================================================== readStatus

test('an absent status is forgiven as pending', () => {
  assert.equal(readOne('a.md', withFrontmatter('order: 1')).status, 'pending');
});

test('an empty status key is forgiven as pending', () => {
  assert.equal(readOne('a.md', withFrontmatter('status:')).status, 'pending');
});

test('each recognised status is read through unchanged', () => {
  // Driven off the validator's own list, so a status added to the union is covered the day it lands.
  for (const status of TASK_STATUSES) {
    assert.equal(readOne('a.md', withFrontmatter(`status: ${status}`)).status, status);
  }
});

test('failed is one of the recognised statuses, and reads back as failed', () => {
  // The escalation record the execution loop commits: it has to survive a round-trip through the file
  // that drives scheduling, or `/run all` has nothing to skip on.
  assert.ok(TASK_STATUSES.includes('failed'), 'failed must be a legal frontmatter status');
  assert.equal(readOne('a.md', withFrontmatter('status: failed\norder: 3')).status, 'failed');
  assert.equal(readOne('a.md', withFrontmatter('status: failed\norder: 3')).order, 3);
});

test('the error naming the legal values lists failed among them', () => {
  // The message is the only place the Breakdown phase is told the vocabulary, so it must not go stale.
  assert.throws(
    () => readOne('a.md', withFrontmatter('status: escalated')),
    (err: unknown) => err instanceof BacklogError && err.message.includes('failed'),
  );
});

test('an unrecognised status fails loud rather than defaulting', () => {
  assert.throws(
    () => readOne('a.md', withFrontmatter('status: finished')),
    (err: unknown) => err instanceof BacklogError && /status 'finished'/.test(err.message),
  );
});

test('status matching is case-sensitive — DONE is not done', () => {
  assert.throws(() => readOne('a.md', withFrontmatter('status: DONE')), BacklogError);
});

test('a non-string status fails loud', () => {
  assert.throws(() => readOne('a.md', withFrontmatter('status: 3')), BacklogError);
});

test('the loud status error names the task by its backlog-relative path', () => {
  assert.throws(
    () => readFixture({ 'epic/story/a.md': withFrontmatter('status: nope') }),
    (err: unknown) => err instanceof BacklogError && err.message.includes("Task 'epic/story/a.md'"),
  );
});

// =================================================================================== readOrder

test('a numeric order is used as given', () => {
  assert.equal(readOne('a.md', withFrontmatter('order: 7')).order, 7);
});

test('a numeric string order is coerced', () => {
  assert.equal(readOne('a.md', withFrontmatter("order: '7'")).order, 7);
});

test('an absent order falls back to the filename number prefix', () => {
  assert.equal(readOne('03-a.md', withFrontmatter('status: pending')).order, 3);
});

test('an unparseable order falls back rather than failing — order is forgiving throughout', () => {
  // Unlike status, EVERY order branch is forgiving: there is no loud branch for it to swap with.
  assert.equal(readOne('03-a.md', withFrontmatter('order: soon')).order, 3);
  assert.equal(readOne('03-a.md', withFrontmatter('order: true')).order, 3);
  assert.equal(readOne('03-a.md', withFrontmatter("order: ''")).order, 3);
});

test('no order and no filename prefix sorts the task last', () => {
  assert.equal(readOne('a.md', withFrontmatter('status: pending')).order, Number.MAX_SAFE_INTEGER);
});

test('the filename prefix is read off the file, not off the folders above it', () => {
  const { tasks } = readFixture({ '02-epic/a.md': withFrontmatter('status: pending') });
  assert.equal(tasks[0]?.order, Number.MAX_SAFE_INTEGER);
});

// =============================================================================== readDependsOn

test('an absent depends_on is an empty list', () => {
  assert.deepEqual(readOne('a.md', withFrontmatter('status: pending')).dependsOn, []);
});

test('a bare string depends_on becomes a one-element list', () => {
  assert.deepEqual(readOne('a.md', withFrontmatter('depends_on: epic/01-x')).dependsOn, ['epic/01-x']);
});

test('an empty-string depends_on is an empty list, not a dependency on the empty id', () => {
  assert.deepEqual(readOne('a.md', withFrontmatter("depends_on: ''")).dependsOn, []);
});

test('a list of ids comes through trimmed', () => {
  assert.deepEqual(readOne('a.md', withFrontmatter("depends_on: [' x ', 'y']")).dependsOn, ['x', 'y']);
});

test('a non-string entry inside the list fails loud and says which index', () => {
  assert.throws(
    () => readOne('a.md', withFrontmatter('depends_on: [x, 3]')),
    (err: unknown) => err instanceof BacklogError && /depends_on\[1\]/.test(err.message),
  );
});

test('a depends_on that is neither string nor list fails loud', () => {
  assert.throws(() => readOne('a.md', withFrontmatter('depends_on: 5')), BacklogError);
  assert.throws(() => readOne('a.md', withFrontmatter('depends_on: {a: 1}')), BacklogError);
});

// ================================================================================= deriveTitle

test('the first H1 in the body is the title', () => {
  const task = readOne('01-a.md', withFrontmatter('status: pending', '# Add hashing test\n\nbody\n'));
  assert.equal(task.title, 'Add hashing test');
});

test('an H1 further down the body still wins over the slug', () => {
  const task = readOne('01-a.md', withFrontmatter('status: pending', 'intro\n\n# Real Title\n'));
  assert.equal(task.title, 'Real Title');
});

test('surrounding whitespace is stripped from the H1', () => {
  assert.equal(readOne('01-a.md', withFrontmatter('status: pending', '#   Padded   \n')).title, 'Padded');
});

test('a hash with no space is not an H1 and falls back to the slug', () => {
  const task = readOne('01-add-hashing-test.md', withFrontmatter('status: pending', '#NotAHeading\n'));
  assert.equal(task.title, 'Add Hashing Test');
});

test('an H2 is not an H1', () => {
  const task = readOne('01-add-hashing-test.md', withFrontmatter('status: pending', '## Sub\n'));
  assert.equal(task.title, 'Add Hashing Test');
});

test('the slug fallback drops the order prefix and title-cases the rest', () => {
  assert.equal(readOne('01_add_test.md', withFrontmatter('status: pending', 'no heading\n')).title, 'Add Test');
});

test('the slug fallback uses the file name, not the folders above it', () => {
  const { tasks } = readFixture({ 'epic-auth/story-signup/02-hash.md': withFrontmatter('status: pending', 'body\n') });
  assert.equal(tasks[0]?.title, 'Hash');
});

// ============================================================================ splitFrontmatter

test('a file with no fence is all body, and every reader takes its forgiving branch', () => {
  const task = readOne('01-a.md', '# Just A Body\n\nno frontmatter here\n');
  assert.equal(task.status, 'pending');
  assert.equal(task.order, 1);
  assert.deepEqual(task.dependsOn, []);
  assert.equal(task.title, 'Just A Body');
});

test('an unterminated fence is treated as no fence at all — the whole file stays body', () => {
  // The opening --- never closes, so `status: done` is body text and the task reads as pending.
  const task = readOne('01-a.md', '---\nstatus: done\n\n# Title\n');
  assert.equal(task.status, 'pending');
  assert.equal(task.title, 'Title');
});

test('CRLF frontmatter parses exactly like LF frontmatter', () => {
  const task = readOne('a.md', '---\r\nstatus: done\r\norder: 4\r\n---\r\n\r\n# CRLF Title\r\n');
  assert.equal(task.status, 'done');
  assert.equal(task.order, 4);
  assert.equal(task.title, 'CRLF Title');
});

test('a UTF-8 BOM before the fence does not hide the frontmatter', () => {
  assert.equal(readOne('a.md', '﻿---\nstatus: done\n---\n\n# T\n').status, 'done');
});

test('frontmatter that is not a mapping is ignored rather than fatal', () => {
  assert.equal(readOne('01-a.md', '---\n- one\n- two\n---\n\n# T\n').status, 'pending');
});

test('malformed YAML in the fence fails loud and points at the Breakdown phase', () => {
  assert.throws(
    () => readOne('a.md', '---\nstatus: "unclosed\n---\n\n# T\n'),
    (err: unknown) => err instanceof BacklogError && /malformed YAML frontmatter/.test(err.message),
  );
});

test('the body is trimmed but otherwise verbatim', () => {
  assert.equal(readOne('a.md', withFrontmatter('status: pending', '\n\n# T\n\nline\n\n')).body, '# T\n\nline');
});

// ================================================================================== tree shape

test('id, epic and story are derived from the path under backlog/', () => {
  const { tasks } = readFixture({ 'epic-auth/story-signup/01-hash.md': withFrontmatter('status: pending') });
  assert.equal(tasks[0]?.id, 'epic-auth/story-signup/01-hash');
  assert.equal(tasks[0]?.epic, 'epic-auth');
  assert.equal(tasks[0]?.story, 'story-signup');
});

test('a task directly under backlog/ has neither epic nor story', () => {
  const task = readOne('a.md', withFrontmatter('status: pending'));
  assert.equal(task.id, 'a');
  assert.equal(task.epic, null);
  assert.equal(task.story, null);
});

test('a task one level down has an epic but no story', () => {
  const { tasks } = readFixture({ 'epic-auth/a.md': withFrontmatter('status: pending') });
  assert.equal(tasks[0]?.epic, 'epic-auth');
  assert.equal(tasks[0]?.story, null);
});

test('a fourth level of nesting fails loud', () => {
  assert.throws(
    () => readFixture({ 'a/b/c/d.md': withFrontmatter('status: pending') }),
    (err: unknown) => err instanceof BacklogError && /nested too deep/.test(err.message),
  );
});

test('README.md documents its level and is never a task', () => {
  const { tasks } = readFixture({
    'README.md': '# Backlog\n',
    'epic/README.md': '# Epic\n',
    'epic/a.md': withFrontmatter('status: pending'),
  });
  assert.deepEqual(tasks.map((t) => t.id), ['epic/a']);
});

test('a lowercase readme.md IS read as a task', () => {
  // CURRENT BEHAVIOUR, and an inconsistency: the .md check is case-insensitive while the README
  // check compares against the exact name, so on a case-insensitive filesystem a level doc written
  // "readme.md" becomes a phantom task titled "Readme". See the report.
  const { tasks } = readFixture({ 'readme.md': '# Docs\n' });
  assert.deepEqual(tasks.map((t) => t.id), ['readme']);
});

test('a non-markdown file is not a task', () => {
  const { tasks } = readFixture({ 'notes.txt': 'hello', 'a.md': withFrontmatter('status: pending') });
  assert.deepEqual(tasks.map((t) => t.id), ['a']);
});

test('tasks come back sorted by order, then by id', () => {
  const { tasks } = readFixture({
    'b.md': withFrontmatter('order: 2'),
    'a.md': withFrontmatter('order: 2'),
    'c.md': withFrontmatter('order: 1'),
  });
  assert.deepEqual(tasks.map((t) => t.id), ['c', 'a', 'b']);
});

test('filePath is the absolute host path to the .md file', () => {
  const task = readOne('epic/a.md', withFrontmatter('status: pending'));
  assert.ok(path.isAbsolute(task.filePath));
  assert.ok(task.filePath.endsWith(`epic${path.sep}a.md`));
});

test('a missing backlog/ directory fails loud and names the Breakdown phase', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'lad-backlog-'));
  try {
    assert.throws(
      () => readBacklog(projectRoot),
      (err: unknown) => err instanceof BacklogError && /No backlog\/ directory/.test(err.message),
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('an empty backlog/ is a valid, empty backlog', () => {
  assert.deepEqual(readFixture({}).tasks, []);
});
