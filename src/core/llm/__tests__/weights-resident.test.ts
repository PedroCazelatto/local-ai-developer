// Pins the residency verdict against the MEASURED table in backlog item 6 — all five rows, as
// fixtures rather than as prose. The table is data; the formula is the thing under test.
//
// The case that matters most is the first one. The task file says `size_vram < size` "is the spill",
// and if that were the verdict then qwen2.5-coder:14b — which spills 1.93 GB — would be marked too
// heavy, contradicting the same file's table, which lists it as the one model on this box whose
// weights stay resident. So `spillsButIsFine` below is not an edge case, it is the whole distinction:
// KV cache may offload, weights may not (docs/product.md).
//
// Two of the five rows were re-measured live against Ollama 0.33.2 and came back byte-identical to the
// table's GB figures, so their `sizeVramBytes` here is the exact number the daemon reported. The other
// three carry the table's GB value × 1e9, which is all the table records — enough for a verdict that
// turns on gigabyte-scale differences, and stated so nobody reads them as byte-exact.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { VramMeasurement } from '../vram-measurement.type.js';
import { weightsResident } from '../weights-resident.js';

/** One row of the measured table: what the model weighs on disk against what stayed on the GPU. */
interface MeasuredRow {
  readonly name: string;
  readonly measurement: VramMeasurement;
  /** The verdict the task file's table records in its "weights resident?" column. */
  readonly resident: boolean;
}

// on-disk bytes are the live `/api/tags` figures; they match the table's GB column to two decimals.
const MEASURED: readonly MeasuredRow[] = [
  {
    name: 'qwen2.5-coder:14b',
    // Live: size 12_415_160_809, size_vram 10_489_209_814 → spills 1.93 GB and is STILL resident.
    measurement: { weightsBytes: 8_988_124_298, sizeVramBytes: 10_489_209_814 },
    resident: true,
  },
  {
    name: 'codestral:22b',
    // Live: size 16_589_038_548, size_vram 10_702_249_000 → 1.87 GB of WEIGHTS outside VRAM, which is
    // the "~1.9 GB of weights on the CPU" the task file annotates this row with.
    measurement: { weightsBytes: 12_569_170_438, sizeVramBytes: 10_702_249_000 },
    resident: false,
  },
  {
    name: 'gpt-oss:20b',
    measurement: { weightsBytes: 13_793_441_244, sizeVramBytes: 10_200_000_000 },
    resident: false,
  },
  {
    name: 'qwen3-coder:30b',
    measurement: { weightsBytes: 18_556_700_761, sizeVramBytes: 10_610_000_000 },
    resident: false,
  },
  {
    name: 'qwen2.5-coder:32b',
    measurement: { weightsBytes: 19_851_349_898, sizeVramBytes: 10_350_000_000 },
    resident: false,
  },
];

test('every row of the measured table is reproduced', () => {
  assert.equal(MEASURED.length, 5, 'all five measured rows are fixtures here');
  for (const row of MEASURED) {
    assert.equal(weightsResident(row.measurement), row.resident, row.name);
  }
});

test('a model can spill and still be resident — the KV cache is what offloaded', () => {
  // The row the naive `size_vram < size` reading gets wrong. Loaded total 12.42 GB, VRAM 10.49 GB, so
  // it plainly spills; the 8.99 GB of weights fit inside the 10.49 GB anyway.
  const loadedTotalBytes = 12_415_160_809;
  const fourteenB = MEASURED[0]?.measurement;
  assert.ok(fourteenB !== undefined);
  assert.ok(fourteenB.sizeVramBytes < loadedTotalBytes, 'this row really does spill');
  assert.equal(weightsResident(fourteenB), true, 'and its weights are still resident');
});

test('only one of the five installed-and-probed models keeps its weights resident', () => {
  // The task file's own conclusion, as a count: three of nine models have no tools and six cannot keep
  // their weights resident, leaving qwen2.5-coder:14b as the only model that can run this product.
  assert.equal(MEASURED.filter((row) => weightsResident(row.measurement)).length, 1);
});

test('weights that exactly fill the resident bytes are resident', () => {
  assert.equal(weightsResident({ weightsBytes: 8_000_000_000, sizeVramBytes: 8_000_000_000 }), true);
});

test('one byte more than fits is not resident', () => {
  assert.equal(weightsResident({ weightsBytes: 8_000_000_001, sizeVramBytes: 8_000_000_000 }), false);
});

test('one byte less than fits is resident — the boundary is checked from both sides', () => {
  assert.equal(weightsResident({ weightsBytes: 7_999_999_999, sizeVramBytes: 8_000_000_000 }), true);
});

test('nothing on the GPU is never resident, however small the model', () => {
  assert.equal(weightsResident({ weightsBytes: 1, sizeVramBytes: 0 }), false);
});
