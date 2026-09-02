// Pins the boot chooser's reference table. Two invariants matter beyond the marker itself: every
// installed model appears (the list has to explain its own omissions — OPEN-QUESTIONS.md #14), and the
// columns line up for any mix of name lengths, since the padding is computed rather than fixed.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { InstalledModel } from '../../llm/list-models.js';
import { NO_TOOLS_MARKER } from '../../ui/no-tools-marker.js';
import { bootModelRows } from '../boot-model-rows.js';

const ESC = String.fromCharCode(27);

function model(name: string, size: number, capabilities: readonly string[]): InstalledModel {
  return { name, size, modifiedAt: new Date('2026-08-01T12:00:00Z'), digest: `digest-${name}`, capabilities };
}

const THIS_BOX: readonly InstalledModel[] = [
  model('codestral:22b', 12_569_170_000, ['completion', 'insert']),
  model('deepseek-coder-v2:16b', 8_905_126_121, ['completion', 'insert']),
  model('gpt-oss:20b', 13_790_000_000, ['completion', 'tools', 'thinking']),
  model('qwen2.5-coder:14b', 8_988_112_041, ['completion', 'tools', 'insert']),
];

test('every installed model gets a row, toolless included', () => {
  const rows = bootModelRows(THIS_BOX);
  assert.equal(rows.length, 4);
  for (const m of THIS_BOX) {
    assert.equal(
      rows.some((r) => r.includes(m.name)),
      true,
      m.name,
    );
  }
});

test('only the toolless rows carry the marker', () => {
  const rows = bootModelRows(THIS_BOX);
  const marked = rows.filter((r) => r.includes(NO_TOOLS_MARKER));
  assert.equal(marked.length, 2);
  assert.equal(
    marked.every((r) => r.includes('codestral') || r.includes('deepseek')),
    true,
  );
});

test('the marker is the shared spelling, not a local one', () => {
  assert.equal(NO_TOOLS_MARKER, '(no tools)');
  assert.match(bootModelRows([model('x:1b', 1024, [])])[0] ?? '', /\(no tools\)$/);
});

test('a capable row ends at its size, with no trailing whitespace to pad the missing marker', () => {
  for (const row of bootModelRows(THIS_BOX)) {
    assert.equal(row, row.trimEnd(), `trailing whitespace: ${JSON.stringify(row)}`);
  }
});

test('names are padded to the widest name, so the size column starts at one index in every row', () => {
  const rows = bootModelRows(THIS_BOX);
  const sizeStarts = rows.map((r) => r.indexOf(' GB'));
  assert.equal(new Set(sizeStarts).size, 1, `size column drifts: ${JSON.stringify(rows)}`);
});

test('one long name widens every row rather than truncating itself', () => {
  const rows = bootModelRows([
    model('a:1b', 2_000_000_000, ['tools']),
    model('a-very-long-model-name-indeed:70b', 40_000_000_000, ['tools']),
  ]);
  assert.equal(rows[0]?.includes('a-very-long'), false);
  assert.equal(rows[1]?.includes('a-very-long-model-name-indeed:70b'), true, 'never truncated');
  assert.equal(rows[0]?.indexOf(' GB'), rows[1]?.indexOf(' GB'), 'both size columns align');
  assert.equal(rows[0]?.length, rows[1]?.length, 'and both rows are therefore the same width');
});

test('sizes are right-aligned, so a 3-char and a 6-char size still line up', () => {
  const rows = bootModelRows([
    model('small:1b', 900, ['tools']),
    model('large:70b', 40_000_000_000, ['tools']),
  ]);
  assert.match(rows[0] ?? '', /900 B$/);
  assert.match(rows[1] ?? '', /37\.3 GB$/);
  assert.equal(rows[0]?.length, rows[1]?.length, 'equal-width rows for equal-width names');
});

test('an empty installed list yields no rows', () => {
  // Stated honestly after mutation testing: dropping the `0` floor from the width SURVIVES, because
  // `.map` never runs on an empty list and so nothing ever reads the -Infinity it would compute. The
  // floor is belt-and-braces, not the thing this case proves — this case proves the empty list is a
  // legal input at all, which the caller relies on (bootModelPlan's `empty` outcome prints instead).
  assert.deepEqual(bootModelRows([]), []);
});

test('rows are plain text — the caller owns every colour', () => {
  for (const row of bootModelRows(THIS_BOX)) {
    assert.equal(row.includes(ESC), false, `ANSI escape in a row: ${JSON.stringify(row)}`);
  }
});
