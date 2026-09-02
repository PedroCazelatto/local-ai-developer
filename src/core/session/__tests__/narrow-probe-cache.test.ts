// Pins the defensive read of vram-probes.json. The file's documented reset gesture is DELETING it, so
// half-deleting it and hand-editing a row are both well within what it will meet — and the rule is
// that one bad row drops itself and the measurements beside it survive.
//
// Getting this direction wrong is cheap in one direction and not the other: a dropped row shows as no
// marker, which under-informs. A trusted bad row would mark a model too heavy that is not.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { narrowProbeCache } from '../narrow-probe-cache.js';

const GOOD = { weightsBytes: 8_988_124_298, sizeVramBytes: 10_489_209_814 };

test('a well-formed file round-trips through JSON unchanged', () => {
  const file = { 'aaa@16384': GOOD, 'bbb@32768': { weightsBytes: 1, sizeVramBytes: 2 } };
  const parsed: unknown = JSON.parse(JSON.stringify(file));
  assert.deepEqual(narrowProbeCache(parsed), file);
});

test('one bad row drops itself and leaves the good ones', () => {
  const narrowed = narrowProbeCache({
    'good@16384': GOOD,
    'string@16384': { weightsBytes: '8988124298', sizeVramBytes: 10_489_209_814 },
    'alsogood@16384': { weightsBytes: 5, sizeVramBytes: 6 },
  });
  assert.deepEqual(Object.keys(narrowed).sort(), ['alsogood@16384', 'good@16384']);
});

test('a row missing either half is not a measurement', () => {
  assert.deepEqual(narrowProbeCache({ a: { weightsBytes: 5 } }), {});
  assert.deepEqual(narrowProbeCache({ a: { sizeVramBytes: 5 } }), {});
  assert.deepEqual(narrowProbeCache({ a: {} }), {});
});

test('NaN, Infinity and negatives are not byte counts', () => {
  // JSON cannot carry NaN, but a hand-edited file reaching here through any other route can.
  assert.deepEqual(narrowProbeCache({ a: { weightsBytes: Number.NaN, sizeVramBytes: 1 } }), {});
  assert.deepEqual(
    narrowProbeCache({ a: { weightsBytes: 1, sizeVramBytes: Number.POSITIVE_INFINITY } }),
    {},
  );
  assert.deepEqual(narrowProbeCache({ a: { weightsBytes: -1, sizeVramBytes: 1 } }), {});
  assert.deepEqual(narrowProbeCache({ a: { weightsBytes: 1, sizeVramBytes: -1 } }), {});
});

test('zero bytes in VRAM is a real measurement and is kept', () => {
  assert.deepEqual(narrowProbeCache({ a: { weightsBytes: 5, sizeVramBytes: 0 } }), {
    a: { weightsBytes: 5, sizeVramBytes: 0 },
  });
});

test('a row that is not an object drops', () => {
  assert.deepEqual(narrowProbeCache({ a: null, b: 5, c: 'x', d: [1, 2], e: GOOD }), { e: GOOD });
});

test('a file that is not an object reads as empty rather than throwing', () => {
  assert.deepEqual(narrowProbeCache(null), {});
  assert.deepEqual(narrowProbeCache(undefined), {});
  assert.deepEqual(narrowProbeCache('{}'), {});
  assert.deepEqual(narrowProbeCache(42), {});
  // An array would answer `in`/index lookups by position, so isRecord excludes it outright.
  assert.deepEqual(narrowProbeCache([GOOD]), {});
});

test('extra fields on a row are dropped, not carried', () => {
  const narrowed = narrowProbeCache({ a: { ...GOOD, probedAt: 'yesterday', verdict: 'fine' } });
  assert.deepEqual(narrowed, { a: GOOD });
});
