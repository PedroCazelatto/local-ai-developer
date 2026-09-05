// Pins the boot chooser's reference table. Three invariants matter beyond the markers themselves:
// every installed model appears (the list has to explain its own omissions — OPEN-QUESTIONS.md #14),
// the columns line up for any mix of name lengths, since the padding is computed rather than fixed,
// and a row carries AT MOST ONE marker, which is what keeps it inside 80 columns.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { InstalledModel } from '../../llm/list-models.js';
import { NO_TOOLS_MARKER } from '../../ui/no-tools-marker.js';
import { TOO_HEAVY_MARKER } from '../../ui/too-heavy-marker.js';
import { bootModelRows } from '../boot-model-rows.js';
import { probeCacheKey } from '../probe-cache-key.js';
import type { ProbeCache } from '../probe-cache.type.js';

const ESC = String.fromCharCode(27);
const NUM_CTX = 16384;

function model(name: string, size: number, capabilities: readonly string[]): InstalledModel {
  return { name, size, modifiedAt: new Date('2026-08-01T12:00:00Z'), digest: `digest-${name}`, capabilities };
}

const THIS_BOX: readonly InstalledModel[] = [
  model('codestral:22b', 12_569_170_000, ['completion', 'insert']),
  model('deepseek-coder-v2:16b', 8_905_126_121, ['completion', 'insert']),
  model('gpt-oss:20b', 13_790_000_000, ['completion', 'tools', 'thinking']),
  model('qwen2.5-coder:14b', 8_988_112_041, ['completion', 'tools', 'insert']),
];

/** Every model above measured at NUM_CTX against the 10.2-10.7 GB ceiling this box really has. */
const PROBED: ProbeCache = Object.fromEntries(
  THIS_BOX.map((m) => [
    probeCacheKey(m.digest, NUM_CTX),
    { weightsBytes: m.size, sizeVramBytes: 10_489_209_814 },
  ]),
);

test('every installed model gets a row, toolless included', () => {
  const rows = bootModelRows(THIS_BOX, {}, NUM_CTX);
  assert.equal(rows.length, 4);
  for (const m of THIS_BOX) {
    assert.equal(
      rows.some((r) => r.includes(m.name)),
      true,
      m.name,
    );
  }
});

test('only the toolless rows carry the no-tools marker', () => {
  const rows = bootModelRows(THIS_BOX, {}, NUM_CTX);
  const marked = rows.filter((r) => r.includes(NO_TOOLS_MARKER));
  assert.equal(marked.length, 2);
  assert.equal(
    marked.every((r) => r.includes('codestral') || r.includes('deepseek')),
    true,
  );
});

test('the marker is the shared spelling, not a local one', () => {
  assert.equal(NO_TOOLS_MARKER, '(no tools)');
  assert.match(bootModelRows([model('x:1b', 1024, [])], {}, NUM_CTX)[0] ?? '', /\(no tools\)$/);
});

test('an empty probe cache marks nothing too heavy — unmeasured is not a verdict', () => {
  for (const row of bootModelRows(THIS_BOX, {}, NUM_CTX)) {
    assert.equal(row.includes(TOO_HEAVY_MARKER), false, row);
  }
});

test('a measured, capable model whose weights do not fit is marked too heavy', () => {
  const rows = bootModelRows(THIS_BOX, PROBED, NUM_CTX);
  // gpt-oss:20b is 13.79 GB on disk against 10.49 GB in VRAM — capable, and not resident.
  const gptOss = rows.find((r) => r.includes('gpt-oss:20b')) ?? '';
  assert.match(gptOss, /\(too heavy\)$/);
  // qwen2.5-coder:14b is 8.99 GB and fits, so it says nothing at all.
  const qwen = rows.find((r) => r.includes('qwen2.5-coder:14b')) ?? '';
  assert.equal(qwen.includes(TOO_HEAVY_MARKER), false);
  assert.equal(qwen.includes(NO_TOOLS_MARKER), false);
});

test('a row never carries both markers — codestral is toolless AND too heavy, and says no tools', () => {
  const codestral =
    bootModelRows(THIS_BOX, PROBED, NUM_CTX).find((r) => r.includes('codestral')) ?? '';
  assert.match(codestral, /\(no tools\)$/);
  assert.equal(codestral.includes(TOO_HEAVY_MARKER), false);
});

test('a measurement at another ceiling does not mark this one', () => {
  // The negative control for the key: the same rows, keyed at 32768, must reach no row at 16384.
  const elsewhere: ProbeCache = Object.fromEntries(
    THIS_BOX.map((m) => [
      probeCacheKey(m.digest, 32768),
      { weightsBytes: m.size, sizeVramBytes: 10_489_209_814 },
    ]),
  );
  for (const row of bootModelRows(THIS_BOX, elsewhere, NUM_CTX)) {
    assert.equal(row.includes(TOO_HEAVY_MARKER), false, row);
  }
  // And the same cache read at ITS ceiling does mark, so the control could have fired. One row, not
  // two: of the four models here only gpt-oss:20b is both tool-capable and over the ceiling —
  // codestral is over it too but shows `(no tools)` instead, which is the precedence rule.
  const atItsCeiling = bootModelRows(THIS_BOX, elsewhere, 32768);
  assert.deepEqual(
    atItsCeiling.filter((r) => r.includes(TOO_HEAVY_MARKER)).map((r) => r.trim().split(' ')[0]),
    ['gpt-oss:20b'],
  );
});

test('a capable row with nothing to say ends at its size, with no trailing whitespace', () => {
  for (const row of bootModelRows(THIS_BOX, PROBED, NUM_CTX)) {
    assert.equal(row, row.trimEnd(), `trailing whitespace: ${JSON.stringify(row)}`);
  }
});

test('names are padded to the widest name, so the size column starts at one index in every row', () => {
  const rows = bootModelRows(THIS_BOX, PROBED, NUM_CTX);
  const sizeStarts = rows.map((r) => r.indexOf(' GB'));
  assert.equal(new Set(sizeStarts).size, 1, `size column drifts: ${JSON.stringify(rows)}`);
});

test('one long name widens every row rather than truncating itself', () => {
  const rows = bootModelRows(
    [
      model('a:1b', 2_000_000_000, ['tools']),
      model('a-very-long-model-name-indeed:70b', 40_000_000_000, ['tools']),
    ],
    {},
    NUM_CTX,
  );
  assert.equal(rows[0]?.includes('a-very-long'), false);
  assert.equal(rows[1]?.includes('a-very-long-model-name-indeed:70b'), true, 'never truncated');
  assert.equal(rows[0]?.indexOf(' GB'), rows[1]?.indexOf(' GB'), 'both size columns align');
  assert.equal(rows[0]?.length, rows[1]?.length, 'and both rows are therefore the same width');
});

test('sizes are right-aligned, so a 3-char and a 6-char size still line up', () => {
  const rows = bootModelRows(
    [model('small:1b', 900, ['tools']), model('large:70b', 40_000_000_000, ['tools'])],
    {},
    NUM_CTX,
  );
  assert.match(rows[0] ?? '', /900 B$/);
  assert.match(rows[1] ?? '', /37\.3 GB$/);
  assert.equal(rows[0]?.length, rows[1]?.length, 'equal-width rows for equal-width names');
});

test('an empty installed list yields no rows', () => {
  // Stated honestly after mutation testing: dropping the `0` floor from the width SURVIVES, because
  // `.map` never runs on an empty list and so nothing ever reads the -Infinity it would compute. The
  // floor is belt-and-braces, not the thing this case proves — this case proves the empty list is a
  // legal input at all, which the caller relies on (bootModelPlan's `empty` outcome prints instead).
  assert.deepEqual(bootModelRows([], {}, NUM_CTX), []);
});

test('rows are plain text — the caller owns every colour', () => {
  for (const row of bootModelRows(THIS_BOX, PROBED, NUM_CTX)) {
    assert.equal(row.includes(ESC), false, `ANSI escape in a row: ${JSON.stringify(row)}`);
  }
});

test('every boot-chooser row fits an 80-column terminal on this box', () => {
  // The chooser has no timestamp column, so it has far more room than `/models list` — but the check
  // is cheap and the marker widths are shared between the two surfaces.
  for (const row of bootModelRows(THIS_BOX, PROBED, NUM_CTX)) {
    assert.ok(row.length <= 80, `${row.length} columns: ${JSON.stringify(row)}`);
  }
});
