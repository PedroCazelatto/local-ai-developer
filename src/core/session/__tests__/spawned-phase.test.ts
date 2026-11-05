// Pins the naming rule #101b rests on: a spawned window's context is recorded under `<base>:spawned`,
// and a colon can never come out of a rules/phases/ filename — so `/resume`'s `phase = ?` filter can
// never list a spawned row, whatever phase the user swaps to.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { spawnedPhase } from '../spawned-phase.js';

test('a spawned window records under its base name plus `:spawned`', () => {
  assert.equal(spawnedPhase('worker'), 'worker:spawned');
  assert.equal(spawnedPhase('debate-challenger'), 'debate-challenger:spawned');
});

test('the recorded name is never the base name a `/swap` could select', () => {
  for (const base of ['worker', 'reviewer', 'retro', 'subagent', 'debate-challenger', 'debate-proponent', 'debate-digest']) {
    assert.notEqual(spawnedPhase(base), base);
    assert.ok(spawnedPhase(base).includes(':'), 'a colon cannot appear in a phase name taken from a filename');
  }
});
