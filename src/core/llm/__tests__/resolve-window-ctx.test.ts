// Pins the one hard constraint backlog item 7 had to keep while deriving the bounded ceiling: every
// WINDOW role — and `summarize` and both debate roles — resolves to the base EXACTLY, at any base,
// because `contexts.num_ctx` stamps the base and `/resume` filters on it. A derived value reaching a
// window role would hide every context in every project. Only the three bounded one-shots move, to half.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CallRole } from '../call-role.type.js';
import { resolveWindowCtx } from '../resolve-window-ctx.js';

const AT_BASE: readonly CallRole[] = [
  'interactive',
  'worker',
  'reviewer',
  'retro',
  'subagent',
  'summarize',
  'debate-turn',
  'debate-digest',
];
const BOUNDED: readonly CallRole[] = ['context-title', 'search-rules', 'commit-message'];
const BASES = [16_384, 8_192, 12_345, 32_768];

test('every window role, summarize and both debate roles get the base unchanged', () => {
  for (const base of BASES) {
    for (const role of AT_BASE) assert.equal(resolveWindowCtx(role, base), base, `${role} at ${base}`);
  }
});

test('the three bounded one-shots get half the base, rounded down', () => {
  for (const base of BASES) {
    for (const role of BOUNDED) assert.equal(resolveWindowCtx(role, base), Math.floor(base / 2), `${role} at ${base}`);
  }
});

test('at the default ceiling the bounded one-shots land on the 8 192 that was measured', () => {
  for (const role of BOUNDED) assert.equal(resolveWindowCtx(role, 16_384), 8_192);
});
