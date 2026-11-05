// Pins the /events reader against the `events` table, written by the real appendEvent in a temp project.
// The invariants: write order, oldest first — two events in the same millisecond included; `detail`
// comes back as it was written; a token figure the event did not carry stays null rather than 0; and
// reading never creates memory.db.

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { appendEvent } from '../../../core/session/events-log.js';
import { memoryDbFile } from '../../../core/session/memory-db-file.js';
import { readEventRows } from '../read-event-rows.js';

function withProject(run: (projectPath: string) => void): void {
  const projectPath = mkdtempSync(path.join(tmpdir(), 'read-event-rows-'));
  try {
    run(projectPath);
  } finally {
    rmSync(projectPath, { recursive: true, force: true });
  }
}

test('a project with no memory.db reports absent, and reading does not create one', () => {
  withProject((projectPath) => {
    const tail = readEventRows(projectPath, 20);
    assert.equal(tail.ok, false);
    assert.equal(tail.ok === false && tail.absent, true);
    assert.equal(existsSync(memoryDbFile(projectPath)), false);
  });
});

test('events come back in write order with their detail, tokens and sub-agent intact', () => {
  withProject((projectPath) => {
    // Back to back: several of these land in the same millisecond, which is what rowid order is for.
    appendEvent(projectPath, { type: 'summarization_fire', phase: 'worker', detail: { before: 12_400, after: 6_100 } });
    appendEvent(projectPath, { type: 'subagent_spawn', phase: 'design', subagentId: 'sub-1', detail: {}, promptTokens: 900 });
    appendEvent(projectPath, { type: 'model_use', phase: '', detail: { to: 'qwen2.5-coder:14b' } });
    const tail = readEventRows(projectPath, 20);
    assert.ok(tail.ok);
    assert.deepEqual(tail.rows.map((r) => r.type), ['summarization_fire', 'subagent_spawn', 'model_use']);
    assert.deepEqual(tail.rows[0]?.detail, { before: 12_400, after: 6_100 });
    assert.equal(tail.rows[1]?.promptTokens, 900);
    assert.equal(tail.rows[1]?.evalTokens, null, 'an absent count is null, never 0');
    assert.equal(tail.rows[1]?.subagentId, 'sub-1');
    assert.equal(tail.rows[2]?.phase, '', 'an event outside any phase keeps its empty phase');
    assert.equal(tail.total, 3);
  });
});

test('a limit keeps the newest events', () => {
  withProject((projectPath) => {
    for (const type of ['phase_swap', 'memory_load', 'turn_cancelled'] as const) {
      appendEvent(projectPath, { type, phase: 'design', detail: {} });
    }
    const tail = readEventRows(projectPath, 1);
    assert.ok(tail.ok);
    assert.deepEqual(tail.rows.map((r) => r.type), ['turn_cancelled']);
    assert.equal(tail.total, 3);
  });
});
