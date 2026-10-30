// Pins the merge that makes the cache grow-only. The property is stated negatively on purpose: the
// interesting assertion is not that the new rows arrive, it is that NO OLD ROW LEAVES — a merge that
// dropped the other ceiling's rows would look identical on a fresh machine and cost 2.7 minutes the
// first time somebody put OLLAMA_NUM_CTX back.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeProbeCache } from '../merge-probe-cache.js';
import type { ProbeCache } from '../probe-cache.type.js';

const AT_16K: ProbeCache = {
  'aaa@16384': { weightsBytes: 8_988_124_298, sizeVramBytes: 10_489_209_814 },
  'bbb@16384': { weightsBytes: 12_569_170_438, sizeVramBytes: 10_702_249_000 },
};
const AT_32K: ProbeCache = {
  'aaa@32768': { weightsBytes: 8_988_124_298, sizeVramBytes: 9_100_000_000 },
};

test('the merge keeps every row from both sides', () => {
  const merged = mergeProbeCache(AT_16K, AT_32K);
  assert.deepEqual(Object.keys(merged).sort(), ['aaa@16384', 'aaa@32768', 'bbb@16384']);
});

test('rows measured at the old ceiling are still readable after measuring at a new one', () => {
  const merged = mergeProbeCache(AT_16K, AT_32K);
  assert.deepEqual(merged['aaa@16384'], {
    weightsBytes: 8_988_124_298,
    sizeVramBytes: 10_489_209_814,
  });
});

test('a key present on both sides takes the fresh measurement', () => {
  const remeasured: ProbeCache = { 'aaa@16384': { weightsBytes: 1, sizeVramBytes: 2 } };
  const merged = mergeProbeCache(AT_16K, remeasured);
  assert.deepEqual(merged['aaa@16384'], { weightsBytes: 1, sizeVramBytes: 2 });
  assert.equal(Object.keys(merged).length, 2, 'and the other row is untouched');
});

test('neither input is mutated — the caller may keep holding what it passed in', () => {
  const existing: Record<string, { weightsBytes: number; sizeVramBytes: number }> = {
    'aaa@16384': { weightsBytes: 1, sizeVramBytes: 2 },
  };
  const fresh: Record<string, { weightsBytes: number; sizeVramBytes: number }> = {
    'bbb@16384': { weightsBytes: 3, sizeVramBytes: 4 },
  };
  const merged = mergeProbeCache(existing, fresh);
  assert.deepEqual(Object.keys(existing), ['aaa@16384']);
  assert.deepEqual(Object.keys(fresh), ['bbb@16384']);
  assert.notEqual(merged, existing);
  assert.notEqual(merged, fresh);
});

test('merging nothing changes nothing', () => {
  assert.deepEqual(mergeProbeCache(AT_16K, {}), AT_16K);
});

test('merging into nothing yields the fresh rows', () => {
  assert.deepEqual(mergeProbeCache({}, AT_32K), AT_32K);
});
