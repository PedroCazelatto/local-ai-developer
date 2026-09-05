// Pins the three rules that stop a Reviewer's self-report from beating git. This is the check the
// harness notes single out as untouchable ("the model's verdict is refused when the repo disagrees"),
// so every branch is pinned here, including the ORDER the pass-path rules fire in.
//
//   1. a "pass" may leave nothing uncommitted;
//   2. a "pass" requires the task marked done;
//   3. a "fail" must name every uncommitted file in an issue.
//
// A "fail" on a clean tree is legal and deliberate — the Reviewer may commit everything and still fail.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ReviewIssue, ReviewVerdict } from '../types.js';
import { verdictGitConflict } from '../verdict-git-conflict.js';
import type { VerdictGitState } from '../verdict-git-conflict.js';

/** A shape-valid verdict; every case overrides only what it is about. */
function verdict(result: 'pass' | 'fail', issues: readonly ReviewIssue[] = []): ReviewVerdict {
  return { result, summary: 'judged.', issues };
}

/** An issue naming `file`; severity/note are irrelevant to the git-consistency rules. */
function issue(file: string): ReviewIssue {
  return { severity: 'major', file, note: 'needs work' };
}

/** State with the defaults a consistent pass would have, so each case states only its own fact. */
function state(over: Partial<VerdictGitState>): VerdictGitState {
  return {
    verdict: verdict('pass'),
    outstanding: [],
    taskMarkedDone: true,
    taskId: 'epic-auth/01-hash',
    ...over,
  };
}

// ------------------------------------------------------------------------------- rule 1: pass

test('a consistent pass on a clean, done task is accepted', () => {
  assert.equal(verdictGitConflict(state({})), null);
});

test('a pass with uncommitted files is refused and every file is named', () => {
  const conflict = verdictGitConflict(state({ outstanding: ['src/a.ts', 'src/b.ts'] }));
  assert.notEqual(conflict, null);
  assert.match(conflict ?? '', /2 file\(s\) are still uncommitted/);
  assert.match(conflict ?? '', /src\/a\.ts, src\/b\.ts/);
});

test('the pass rules fire in order: uncommitted work is reported before the unmarked task', () => {
  // Both are wrong. The uncommitted files are the message, because that is the fix that comes first.
  const conflict = verdictGitConflict(state({ outstanding: ['src/a.ts'], taskMarkedDone: false }));
  assert.match(conflict ?? '', /still uncommitted/);
  assert.doesNotMatch(conflict ?? '', /not marked done/);
});

// ------------------------------------------------------------------------------- rule 2: pass

test('a pass on a clean tree is refused while the task is not marked done', () => {
  const conflict = verdictGitConflict(state({ taskMarkedDone: false }));
  assert.match(conflict ?? '', /is not marked done/);
  assert.match(conflict ?? '', /epic-auth\/01-hash/);
});

// ------------------------------------------------------------------------------- rule 3: fail

test('a fail on a clean tree is legal — the Reviewer may commit everything and still fail', () => {
  assert.equal(verdictGitConflict(state({ verdict: verdict('fail', [issue('')]), outstanding: [] })), null);
});

test('a fail naming every uncommitted file is accepted', () => {
  const conflict = verdictGitConflict(
    state({
      verdict: verdict('fail', [issue('src/a.ts'), issue('src/b.ts')]),
      outstanding: ['src/a.ts', 'src/b.ts'],
    }),
  );
  assert.equal(conflict, null);
});

test('a fail leaving a file unexplained is refused, and only the unexplained file is named', () => {
  const conflict = verdictGitConflict(
    state({ verdict: verdict('fail', [issue('src/a.ts')]), outstanding: ['src/a.ts', 'src/b.ts'] }),
  );
  assert.match(conflict ?? '', /1 file\(s\) uncommitted with no issue/);
  assert.match(conflict ?? '', /src\/b\.ts/);
  assert.doesNotMatch(conflict ?? '', /src\/a\.ts/);
});

test('the fail path does not care whether the task is marked done', () => {
  const both = [true, false].map((taskMarkedDone) =>
    verdictGitConflict(state({ verdict: verdict('fail', [issue('src/a.ts')]), outstanding: ['src/a.ts'], taskMarkedDone })),
  );
  assert.deepEqual(both, [null, null]);
});

// --------------------------------------------------------------- path matching (toPosixTrimmed)

test('a backslash path in the verdict covers the same file reported with slashes', () => {
  // The model echoes whatever separator it saw; normalizing is what keeps a real issue from being
  // read as an unexplained file.
  const conflict = verdictGitConflict(
    state({ verdict: verdict('fail', [issue('src\\a.ts')]), outstanding: ['src/a.ts'] }),
  );
  assert.equal(conflict, null);
});

test('surrounding whitespace in either path is trimmed before comparing', () => {
  const conflict = verdictGitConflict(
    state({ verdict: verdict('fail', [issue('  src/a.ts ')]), outstanding: ['\tsrc/a.ts\n'] }),
  );
  assert.equal(conflict, null);
});

test('an empty outstanding entry is dropped rather than demanding an issue for ""', () => {
  assert.equal(verdictGitConflict(state({ outstanding: ['', '   '] })), null);
});

test('an issue with no file covers nothing — a general remark cannot excuse a left-behind file', () => {
  const conflict = verdictGitConflict(
    state({ verdict: verdict('fail', [issue('')]), outstanding: ['src/a.ts'] }),
  );
  assert.match(conflict ?? '', /src\/a\.ts/);
});

test('an issue naming a directory covers every uncommitted file under it', () => {
  const conflict = verdictGitConflict(
    state({ verdict: verdict('fail', [issue('src/core')]), outstanding: ['src/core/a.ts', 'src/core/ui/b.ts'] }),
  );
  assert.equal(conflict, null);
});

test('a directory issue written with a trailing slash covers the same files', () => {
  const conflict = verdictGitConflict(
    state({ verdict: verdict('fail', [issue('src/core/')]), outstanding: ['src/core/a.ts'] }),
  );
  assert.equal(conflict, null);
});

test('a directory issue does not cover a sibling whose name merely shares the prefix', () => {
  // "src/core" must not silently excuse "src/core-utils/a.ts" — the guard is the appended separator.
  const conflict = verdictGitConflict(
    state({ verdict: verdict('fail', [issue('src/core')]), outstanding: ['src/core-utils/a.ts'] }),
  );
  assert.match(conflict ?? '', /src\/core-utils\/a\.ts/);
});
