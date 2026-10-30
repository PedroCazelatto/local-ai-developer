// Pins replaceStatus — the surgical frontmatter rewrite that flips one task's status and must leave
// everything else in the file byte-for-byte alone. Four shapes decide which branch it takes, and the
// task file names all four: CRLF line endings, no fence at all, an unterminated fence, and a fence
// with no `status` key yet.
//
// replaceStatus is private to backlog.ts, so it is driven through setTaskStatus against a real file
// in the OS temp directory — no Docker, no Ollama, no terminal. Comparing the bytes written back is
// in fact a stronger check than calling it directly, because it also proves setTaskStatus does not
// re-encode the file on the way through.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { BacklogError } from '../backlog-error.js';
import { readBacklog } from '../read-backlog.js';
import { setTaskStatus } from '../set-task-status.js';
import type { TaskStatus } from '../task-status.type.js';
import { TASK_STATUSES } from '../task-statuses.js';

/** Write `text` as backlog/a.md, flip it to `status`, and hand back the exact bytes on disk after. */
function rewrite(text: string, status: TaskStatus = 'done'): string {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'lad-status-'));
  try {
    const full = path.join(projectRoot, 'backlog', 'a.md');
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text, 'utf-8');
    setTaskStatus(projectRoot, 'a', status);
    return readFileSync(full, 'utf-8');
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

// ==================================================================== an existing status: key

test('an existing status line is replaced and nothing else moves', () => {
  assert.equal(
    rewrite('---\nstatus: pending\norder: 1\n---\n\n# T\n\nbody\n'),
    '---\nstatus: done\norder: 1\n---\n\n# T\n\nbody\n',
  );
});

test('the trailing newline of the file is preserved, and its absence is preserved too', () => {
  assert.equal(rewrite('---\nstatus: pending\n---\n'), '---\nstatus: done\n---\n');
  assert.equal(rewrite('---\nstatus: pending\n---'), '---\nstatus: done\n---');
});

test('a status line written with odd spacing is normalised to the canonical spelling', () => {
  assert.equal(rewrite('---\n  status  :   pending\n---\n'), '---\nstatus: done\n---\n');
});

test('only the first status line in the block is rewritten', () => {
  // First match wins and the function returns; a duplicate key is a malformed file either way.
  assert.equal(
    rewrite('---\nstatus: pending\nstatus: pending\n---\n'),
    '---\nstatus: done\nstatus: pending\n---\n',
  );
});

test('a status line below the closing fence is body text and is left alone', () => {
  assert.equal(
    rewrite('---\norder: 1\n---\n\nstatus: not-frontmatter\n'),
    '---\nstatus: done\norder: 1\n---\n\nstatus: not-frontmatter\n',
  );
});

test('every status value round-trips through the file', () => {
  for (const status of TASK_STATUSES) {
    assert.equal(rewrite('---\nstatus: pending\n---\n', status), `---\nstatus: ${status}\n---\n`);
  }
});

test('failed is written as a plain frontmatter status like any other', () => {
  // The record the execution loop commits on an escalation. Spelled out rather than left to the loop
  // above, because this exact byte sequence is what resolveSelector('all') then skips on.
  assert.equal(
    rewrite('---\nstatus: in_progress\norder: 1\n---\n\n# T\n', 'failed'),
    '---\nstatus: failed\norder: 1\n---\n\n# T\n',
  );
});

test('a failed task can be flipped again — the record is not a one-way door', () => {
  // /run <id> retries a failed task from scratch, so the loop sets it in_progress again over the top.
  assert.equal(rewrite('---\nstatus: failed\n---\n', 'in_progress'), '---\nstatus: in_progress\n---\n');
});

// =============================================================================== CRLF handling

test('a CRLF file stays CRLF throughout', () => {
  assert.equal(
    rewrite('---\r\nstatus: pending\r\norder: 1\r\n---\r\n\r\n# T\r\n'),
    '---\r\nstatus: done\r\norder: 1\r\n---\r\n\r\n# T\r\n',
  );
});

test('a CRLF file with no status key gets a CRLF-terminated one', () => {
  assert.equal(rewrite('---\r\norder: 1\r\n---\r\n'), '---\r\nstatus: done\r\norder: 1\r\n---\r\n');
});

test('a CRLF file with no fence gets a CRLF-terminated block', () => {
  assert.equal(rewrite('# T\r\n'), '---\r\nstatus: done\r\n---\r\n\r\n# T\r\n');
});

test('a MIXED-ending file is rewritten wholly as CRLF', () => {
  // One CRLF anywhere decides the whole file. Pinned as the CURRENT behaviour — the rewrite is not
  // as surgical as its doc comment claims for a file that mixes endings. See the report.
  assert.equal(
    rewrite('---\r\nstatus: pending\r\n---\nbody\n'),
    '---\r\nstatus: done\r\n---\r\nbody\r\n',
  );
});

// ================================================================================== no fence

test('a file with no frontmatter gets a fresh block prepended, body untouched', () => {
  assert.equal(rewrite('# T\n\nbody\n'), '---\nstatus: done\n---\n\n# T\n\nbody\n');
});

test('an empty file gets a frontmatter block', () => {
  assert.equal(rewrite(''), '---\nstatus: done\n---\n\n');
});

test('a fence-looking line that is not the FIRST line does not count as frontmatter', () => {
  assert.equal(rewrite('intro\n---\nstatus: pending\n---\n'), '---\nstatus: done\n---\n\nintro\n---\nstatus: pending\n---\n');
});

// ========================================================================= unterminated fence

test('an unterminated fence gets a fresh block prepended rather than being patched', () => {
  // The original text survives verbatim as body, so nothing the model wrote is destroyed.
  assert.equal(
    rewrite('---\nstatus: pending\n# T\n'),
    '---\nstatus: done\n---\n\n---\nstatus: pending\n# T\n',
  );
});

test('a lone --- line is an unterminated fence', () => {
  assert.equal(rewrite('---\n'), '---\nstatus: done\n---\n\n---\n');
});

// ============================================================================= no status key

test('a fence with other keys gains status at the TOP of the block', () => {
  assert.equal(
    rewrite('---\norder: 1\ndepends_on: [x]\n---\n\n# T\n'),
    '---\nstatus: done\norder: 1\ndepends_on: [x]\n---\n\n# T\n',
  );
});

test('an empty fence block gains a status line', () => {
  assert.equal(rewrite('---\n---\n\n# T\n'), '---\nstatus: done\n---\n\n# T\n');
});

test('a key merely containing "status" is not mistaken for the status key', () => {
  assert.equal(
    rewrite('---\nreview_status: ok\n---\n'),
    '---\nstatus: done\nreview_status: ok\n---\n',
  );
});

// ==================================================================================== BOM

test('a BOM before the fence does not defeat the fence detection, and survives the rewrite', () => {
  assert.equal(rewrite('﻿---\nstatus: pending\n---\n'), '﻿---\nstatus: done\n---\n');
});

// ============================================================== setTaskStatus around the rewrite

test('the flipped status is what readBacklog reads back', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'lad-status-'));
  try {
    const full = path.join(projectRoot, 'backlog', 'epic', '01-hash.md');
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, '---\nstatus: pending\norder: 2\n---\n\n# Hash\n', 'utf-8');
    setTaskStatus(projectRoot, 'epic/01-hash', 'done');
    const { tasks } = readBacklog(projectRoot);
    assert.equal(tasks[0]?.status, 'done');
    assert.equal(tasks[0]?.order, 2);
    assert.equal(tasks[0]?.title, 'Hash');
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('flipping a task id that has no file fails loud instead of creating one', () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'lad-status-'));
  try {
    mkdirSync(path.join(projectRoot, 'backlog'), { recursive: true });
    assert.throws(
      () => setTaskStatus(projectRoot, 'ghost', 'done'),
      (err: unknown) => err instanceof BacklogError && /not found in the backlog/.test(err.message),
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});
