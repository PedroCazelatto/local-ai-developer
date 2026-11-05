// Pins the /audit reader against the `tool_audit` table backlog item 19 moved the log into, written by
// the real appendAuditRow in a temp project — the filesystem and node:sqlite, nothing heavier. The
// invariants: rows come back in the order they were WRITTEN, oldest first, whatever their timestamps
// say; `total` counts the whole table; reading never creates memory.db; and the row keeps the 1 KB
// preview cap and records whether it cut.

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { appendAuditRow, OUTPUT_PREVIEW_LIMIT } from '../../../core/session/audit.js';
import { memoryDbFile } from '../../../core/session/memory-db-file.js';
import { openMemoryDb } from '../../../core/session/open-memory-db.js';
import type { ToolCallRecord } from '../../../core/session/tool-call-record.type.js';
import { readAuditRows } from '../read-audit-rows.js';

function withProject(run: (projectPath: string) => void): void {
  const projectPath = mkdtempSync(path.join(tmpdir(), 'read-audit-rows-'));
  try {
    run(projectPath);
  } finally {
    rmSync(projectPath, { recursive: true, force: true });
  }
}

function call(tool: string, ts: string, extra: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return { ts, phase: 'design', tool, args: { path: 'a.ts' }, exitStatus: 0, durationMs: 12, output: 'ok', error: null, ...extra };
}

test('a project with no memory.db reports absent, and reading does not create one', () => {
  withProject((projectPath) => {
    const tail = readAuditRows(projectPath, 20);
    assert.deepEqual(tail, { ok: false, absent: true, error: 'No tool calls recorded yet in this project.' });
    assert.equal(existsSync(memoryDbFile(projectPath)), false);
  });
});

test('rows come back in write order, oldest first, even when a later-written call started earlier', () => {
  withProject((projectPath) => {
    // A sub-agent's call finishes (and is written) INSIDE its master's spawn call, which started first.
    appendAuditRow(projectPath, call('read_file', '2026-11-05T10:00:05.000Z', { subagentId: 'sub-1' }));
    appendAuditRow(projectPath, call('spawn_subagent', '2026-11-05T10:00:01.000Z'));
    appendAuditRow(projectPath, call('list_files', '2026-11-05T10:00:09.000Z'));
    const tail = readAuditRows(projectPath, 20);
    assert.ok(tail.ok);
    assert.deepEqual(tail.rows.map((r) => r.tool), ['read_file', 'spawn_subagent', 'list_files']);
    assert.equal(tail.rows[0]?.subagentId, 'sub-1');
    assert.equal(tail.rows[1]?.subagentId, undefined, 'a master-phase call carries no sub-agent field');
    assert.equal(tail.total, 3);
    assert.equal(tail.malformed, 0);
  });
});

test('a limit keeps the newest rows and still reports the whole total', () => {
  withProject((projectPath) => {
    for (const tool of ['a', 'b', 'c', 'd']) appendAuditRow(projectPath, call(tool, '2026-11-05T10:00:00.000Z'));
    const tail = readAuditRows(projectPath, 2);
    assert.ok(tail.ok);
    assert.deepEqual(tail.rows.map((r) => r.tool), ['c', 'd']);
    assert.equal(tail.total, 4);
  });
});

test('the row keeps a 1 KB preview and records that it cut', () => {
  withProject((projectPath) => {
    appendAuditRow(projectPath, call('run_in_project', '2026-11-05T10:00:00.000Z', { output: 'x'.repeat(5_000) }));
    const db = openMemoryDb(projectPath);
    try {
      const row = db.prepare('SELECT output_preview, output_truncated, args FROM tool_audit').get();
      assert.equal(String(row?.['output_preview']).length, OUTPUT_PREVIEW_LIMIT);
      assert.equal(row?.['output_truncated'], 1);
      assert.deepEqual(JSON.parse(String(row?.['args'])), { path: 'a.ts' });
    } finally {
      db.close();
    }
  });
});
