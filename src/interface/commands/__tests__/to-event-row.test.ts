// Pins the narrowing /events applies to a table row: what it requires, and that it refuses rather than
// guesses — a `detail` that is not a flat object of strings, numbers and booleans is not a row.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toEventRow } from '../to-event-row.js';

const ROW = { ts: '2026-11-05T10:00:00.000Z', type: 'eviction_fire', phase: 'worker', subagent_id: null, detail: '{"evicted":3,"incomplete":true}', prompt_tokens: null, eval_tokens: 7 };

test('a well-formed row narrows, with its detail parsed and absent fields absent', () => {
  assert.deepEqual(toEventRow(ROW), {
    ts: ROW.ts,
    type: 'eviction_fire',
    phase: 'worker',
    detail: { evicted: 3, incomplete: true },
    promptTokens: null,
    evalTokens: 7,
  });
});

test('an empty phase is a row; a missing one is not', () => {
  assert.equal(toEventRow({ ...ROW, phase: '' })?.phase, '');
  assert.equal(toEventRow({ ...ROW, phase: null }), undefined);
});

test('a detail that is not a flat JSON object refuses the row', () => {
  for (const detail of ['not json', '[1,2]', '"text"', '{"nested":{"a":1}}', 'null']) {
    assert.equal(toEventRow({ ...ROW, detail }), undefined, detail);
  }
});

test('a row missing its stamp or its type is not a row', () => {
  assert.equal(toEventRow({ ...ROW, ts: '' }), undefined);
  assert.equal(toEventRow({ ...ROW, type: undefined }), undefined);
  assert.equal(toEventRow(null), undefined);
});
