// Pins the spawned-window write path (backlog item 9) against a real memory.db in the OS temp directory —
// the filesystem and node:sqlite, no model, no container, no terminal. The invariants:
//   - nothing is written before the first flush, and the first flush creates ONE context under the
//     namespaced phase, titled by the orchestrator and stamped with the exact ceiling;
//   - rows are what was generated, in order — the system prompt is never one, and only a reply carries
//     tokens and a model;
//   - a collapse writes a `summary` row and points exactly the collapsed rows at it, leaving them in the
//     table, and the numbering stays aligned with the window's array after the splice;
//   - `/resume`'s listing for the base phase never shows a spawned context (#101b).

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { listContexts } from '../list-contexts.js';
import { openMemoryDb } from '../open-memory-db.js';
import { SpawnedTrace } from '../spawned-trace.js';

const NO_TOKENS = { prompt: null, completion: null } as const;

interface Row {
  readonly seq: number;
  readonly role: string;
  readonly content: string;
  readonly model: string | null;
  readonly tool_name: string | null;
  readonly prompt_tokens: number | null;
  readonly replaced_by: string | null;
  readonly id: string;
}

function withProject(run: (projectPath: string) => void): void {
  const projectPath = mkdtempSync(path.join(tmpdir(), 'spawned-trace-'));
  try {
    run(projectPath);
  } finally {
    rmSync(projectPath, { recursive: true, force: true });
  }
}

function readAll(projectPath: string): { contexts: Record<string, unknown>[]; rows: Row[] } {
  const db = openMemoryDb(projectPath);
  try {
    const contexts = db.prepare('SELECT id, phase, title, num_ctx FROM contexts').all();
    const rows = db
      .prepare('SELECT id, seq, role, content, model, tool_name, prompt_tokens, replaced_by FROM messages ORDER BY seq')
      .all() as unknown as Row[];
    return { contexts, rows };
  } finally {
    db.close();
  }
}

test('nothing is written until a flush, and the first flush creates one titled, namespaced context', () => {
  withProject((projectPath) => {
    const trace = new SpawnedTrace(projectPath, 16_384, 'worker:spawned', 'Worker 01-login-form');
    trace.record({ role: 'user', content: 'seed' }, NO_TOKENS, undefined);
    assert.deepEqual(readAll(projectPath).contexts, []);
    trace.flush();
    trace.flush(); // nothing pending: a no-op, not a second context
    const { contexts, rows } = readAll(projectPath);
    assert.equal(contexts.length, 1);
    assert.equal(contexts[0]?.['phase'], 'worker:spawned');
    assert.equal(contexts[0]?.['title'], 'Worker 01-login-form');
    assert.equal(contexts[0]?.['num_ctx'], 16_384);
    assert.equal(rows.length, 1);
  });
});

test('rows are what was generated, in order, and only a reply carries tokens and a model', () => {
  withProject((projectPath) => {
    const trace = new SpawnedTrace(projectPath, 16_384, 'reviewer:spawned', 'Reviewer 01 round 1');
    trace.record({ role: 'user', content: 'seed' }, NO_TOKENS, undefined);
    trace.record({ role: 'assistant', content: '' , tool_calls: [{ function: { name: 'read_file', arguments: { path: 'a.ts' } } }] }, { prompt: 900, completion: 12 }, 'qwen2.5-coder:14b');
    trace.record({ role: 'tool', content: 'file body', tool_name: 'read_file' }, NO_TOKENS, undefined);
    trace.flush();
    const { rows } = readAll(projectPath);
    assert.deepEqual(rows.map((r) => [r.seq, r.role]), [[1, 'user'], [2, 'assistant'], [3, 'tool']]);
    assert.equal(rows[1]?.prompt_tokens, 900);
    assert.equal(rows[1]?.model, 'qwen2.5-coder:14b');
    assert.equal(rows[0]?.model, null);
    assert.equal(rows[2]?.tool_name, 'read_file');
  });
});

test('the system prompt is never a row', () => {
  withProject((projectPath) => {
    const trace = new SpawnedTrace(projectPath, 16_384, 'retro:spawned', 'Retro 01');
    assert.throws(() => trace.record({ role: 'system', content: 'prompt' }, NO_TOKENS, undefined), /system/);
  });
});

test('a collapse adds a summary row, points exactly the collapsed rows at it, and keeps them', () => {
  withProject((projectPath) => {
    const trace = new SpawnedTrace(projectPath, 16_384, 'worker:spawned', 'Worker 01');
    // The window: [0] system (never recorded), [1] seed, [2..5] four turns.
    for (const content of ['seed', 'a', 'b', 'c', 'd']) trace.record({ role: 'user', content }, NO_TOKENS, undefined);
    // The window replaced [2, 4) — `a` and `b` — with one summary at index 2.
    trace.collapse(2, 2, 'summary of a and b', { prompt: 50, completion: 5 }, 'm');
    const first = readAll(projectPath).rows;
    const summary = first.find((r) => r.role === 'summary');
    assert.ok(summary !== undefined);
    assert.deepEqual(first.filter((r) => r.replaced_by === summary.id).map((r) => r.content), ['a', 'b']);
    assert.equal(first.length, 6, 'the originals stay in the table');

    // The window is now [0] system, [1] seed, [2] summary, [3] c, [4] d, [5] e. Collapsing [2, 4) must
    // reach the summary and `c` — proof the numbering followed the splice.
    trace.record({ role: 'user', content: 'e' }, NO_TOKENS, undefined);
    trace.collapse(2, 2, 'second summary', NO_TOKENS, undefined);
    const second = readAll(projectPath).rows;
    const next = second.find((r) => r.content === 'second summary');
    assert.ok(next !== undefined);
    assert.deepEqual(second.filter((r) => r.replaced_by === next.id).map((r) => r.content).sort(), ['c', 'summary of a and b']);
    assert.equal(second.find((r) => r.content === 'seed')?.replaced_by, null, 'the seed is never collapsed');
  });
});

test('the /resume listing for the base phase never shows a spawned context', () => {
  withProject((projectPath) => {
    const trace = new SpawnedTrace(projectPath, 16_384, 'worker:spawned', 'Worker 01');
    trace.record({ role: 'user', content: 'seed' }, NO_TOKENS, undefined);
    trace.flush();
    const db = openMemoryDb(projectPath);
    try {
      assert.deepEqual(listContexts(db, 'worker', 16_384, 50, null), []);
      assert.equal(listContexts(db, 'worker:spawned', 16_384, 50, null).length, 1);
    } finally {
      db.close();
    }
  });
});

test('a long title is capped like every stored title', () => {
  withProject((projectPath) => {
    const trace = new SpawnedTrace(projectPath, 16_384, 'debate-challenger:spawned', `Debate challenger: ${'word '.repeat(40)}`);
    trace.record({ role: 'user', content: 'seed' }, NO_TOKENS, undefined);
    trace.flush();
    const title = String(readAll(projectPath).contexts[0]?.['title']);
    assert.ok(title.length <= 60, title);
  });
});
