// Pins the capability GATE. The three toolless models measured on this box are the fixtures, because
// the bug this closes was a real pick landing on deepseek-coder-v2:16b — `completion,insert`.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { supportsTools } from '../supports-tools.js';

test('a model reporting tools passes, whatever else it reports', () => {
  assert.equal(supportsTools(['completion', 'tools', 'insert']), true);
  assert.equal(supportsTools(['completion', 'tools']), true);
  assert.equal(supportsTools(['vision', 'completion', 'tools', 'thinking']), true);
  assert.equal(supportsTools(['tools']), true);
});

test('the three toolless models measured on this box all fail', () => {
  assert.equal(supportsTools(['completion', 'insert']), false, 'deepseek-coder-v2:16b, codestral:22b');
  assert.equal(supportsTools(['completion', 'thinking']), false, 'deepseek-r1:14b');
});

test('an empty list fails — which is what an unreadable capabilities field becomes', () => {
  assert.equal(supportsTools([]), false);
});

test('the match is exact, not a substring or a prefix', () => {
  assert.equal(supportsTools(['tooling']), false);
  assert.equal(supportsTools(['tool']), false);
  assert.equal(supportsTools(['Tools']), false, 'the daemon reports lower case; nothing normalises here');
});
