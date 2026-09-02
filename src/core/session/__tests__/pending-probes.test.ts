// Pins the accumulate-never-invalidate property in the one place it is observable without a clock:
// pendingProbes is what decides whether ~18 s of GPU time is spent, so "changing OLLAMA_NUM_CTX back
// costs nothing" is exactly the statement that this returns an empty list.
//
// The four cases that are the design, rather than coverage:
//   - measure at ceiling A, and A is done;
//   - move to ceiling B, and everything is pending again (the KV cache grows with the ceiling, #96);
//   - come back to A, and NOTHING is pending — the old rows were kept, not invalidated;
//   - re-pull a tag, and that model alone is pending, because the key's model half is the digest.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { InstalledModel } from '../../llm/list-models.js';
import type { VramMeasurement } from '../../llm/vram-measurement.type.js';
import { pendingProbes } from '../pending-probes.js';
import { probeCacheKey } from '../probe-cache-key.js';
import type { ProbeCache } from '../probe-cache.type.js';

const CEILING_A = 16384;
const CEILING_B = 32768;

function model(name: string, digest: string, size = 9_000_000_000): InstalledModel {
  return {
    name,
    size,
    modifiedAt: new Date('2026-08-01T12:00:00Z'),
    digest,
    capabilities: ['completion', 'tools'],
  };
}

const INSTALLED: readonly InstalledModel[] = [
  model('qwen2.5-coder:14b', 'aaa111'),
  model('codestral:22b', 'bbb222', 12_569_170_438),
  model('gpt-oss:20b', 'ccc333', 13_793_441_244),
];

/** Every installed model measured at `numCtx`, as the probe would have left the cache. */
function measuredAll(numCtx: number, base: ProbeCache = {}): ProbeCache {
  const rows: Record<string, VramMeasurement> = { ...base };
  for (const m of INSTALLED) {
    rows[probeCacheKey(m.digest, numCtx)] = { weightsBytes: m.size, sizeVramBytes: 10_400_000_000 };
  }
  return rows;
}

function names(models: readonly InstalledModel[]): string[] {
  return models.map((m) => m.name);
}

test('an empty cache leaves every model pending', () => {
  assert.deepEqual(names(pendingProbes(INSTALLED, {}, CEILING_A)), [
    'qwen2.5-coder:14b',
    'codestral:22b',
    'gpt-oss:20b',
  ]);
});

test('measured at a ceiling means nothing pending at that ceiling', () => {
  assert.deepEqual(pendingProbes(INSTALLED, measuredAll(CEILING_A), CEILING_A), []);
});

test('a new ceiling makes everything pending again — the verdict depends on num_ctx', () => {
  const atA = measuredAll(CEILING_A);
  assert.equal(pendingProbes(INSTALLED, atA, CEILING_B).length, 3);
});

test('THE ACCUMULATION PROPERTY: measuring at B keeps A, so going back to A re-probes nothing', () => {
  const atA = measuredAll(CEILING_A);
  const atBoth = measuredAll(CEILING_B, atA);
  assert.deepEqual(pendingProbes(INSTALLED, atBoth, CEILING_B), [], 'B is measured');
  assert.deepEqual(pendingProbes(INSTALLED, atBoth, CEILING_A), [], 'and A survived');
  assert.equal(Object.keys(atBoth).length, 6, 'six rows: three models at two ceilings');
});

test('a re-pulled tag is pending again, and only that one', () => {
  const atA = measuredAll(CEILING_A);
  // Same name, different bytes — exactly what re-pulling a moving tag does.
  const rePulled = [model('qwen2.5-coder:14b', 'zzz999'), ...INSTALLED.slice(1)];
  assert.deepEqual(names(pendingProbes(rePulled, atA, CEILING_A)), ['qwen2.5-coder:14b']);
});

test('a partially measured cache leaves exactly the unmeasured models pending', () => {
  const partial: ProbeCache = {
    [probeCacheKey('bbb222', CEILING_A)]: { weightsBytes: 1, sizeVramBytes: 2 },
  };
  assert.deepEqual(names(pendingProbes(INSTALLED, partial, CEILING_A)), [
    'qwen2.5-coder:14b',
    'gpt-oss:20b',
  ]);
});

test('order is the order given, so progress lines follow the list the user saw', () => {
  const reversed = [...INSTALLED].reverse();
  assert.deepEqual(names(pendingProbes(reversed, {}, CEILING_A)), names(reversed));
});

test('a row keyed at another ceiling never satisfies this one', () => {
  // The negative control for the key: a cache full of the right digests at the wrong ceiling must
  // leave every model pending, not none.
  assert.equal(pendingProbes(INSTALLED, measuredAll(4096), CEILING_A).length, 3);
});

test('nothing installed means nothing to probe', () => {
  assert.deepEqual(pendingProbes([], measuredAll(CEILING_A), CEILING_A), []);
});
