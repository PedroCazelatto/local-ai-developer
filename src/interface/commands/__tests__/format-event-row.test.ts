// Pins one /events line. The clock column is LOCAL time (audit-clock.ts), so it is matched by shape;
// everything after it is exact: padded phase and type, the detail as it was written, tokens only when
// the event carried them, and a sub-agent's id last — the same order /audit uses.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { EventRow } from '../event-row.type.js';
import { formatEventRow } from '../format-event-row.js';

const BASE: EventRow = {
  ts: '2026-11-05T10:00:00.000Z',
  type: 'summarization_fire',
  phase: 'worker',
  detail: { before: 12_400, after: 6_100 },
  promptTokens: null,
  evalTokens: null,
};

test('the detail fields are printed as written, after the padded phase and type', () => {
  const line = formatEventRow(BASE, { phase: 8, type: 20 });
  assert.match(line, /^\d\d:\d\d:\d\d · worker   · summarization_fire   · before=12400 after=6100$/);
});

test('tokens appear only when carried, and a sub-agent id comes last', () => {
  const line = formatEventRow({ ...BASE, type: 'subagent_spawn', detail: {}, promptTokens: 1_234, subagentId: 'sub-1' }, { phase: 6, type: 14 });
  assert.match(line, / · subagent_spawn · prompt 1,234 · sub:sub-1$/);
});

test('an event outside any phase shows `-` rather than an empty column', () => {
  const line = formatEventRow({ ...BASE, phase: '', type: 'model_use', detail: { to: 'm' } }, { phase: 1, type: 9 });
  assert.match(line, /^\d\d:\d\d:\d\d · - · model_use · to=m$/);
});
