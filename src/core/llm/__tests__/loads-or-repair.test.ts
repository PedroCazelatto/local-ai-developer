// Pins the whole-string tolerant parse. The condition that distinguishes it from repairDecode is the
// one worth pinning: the decode must consume the WHOLE text (modulo trailing whitespace), which is
// what makes it safe to hand an entire model reply to without a prose tail parsing as an object.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadsOrRepair } from '../loads-or-repair.js';

test('well-formed JSON parses strictly', () => {
  assert.deepEqual(loadsOrRepair('{"a":1}'), { a: 1 });
});

test('non-object JSON parses too — this is JSON.parse, not an object parser', () => {
  assert.deepEqual(loadsOrRepair('[1,2]'), [1, 2]);
  assert.equal(loadsOrRepair('42'), 42);
  assert.equal(loadsOrRepair('"text"'), 'text');
  assert.equal(loadsOrRepair('true'), true);
});

test('a literal control character inside a string falls through to the repair pass', () => {
  assert.deepEqual(loadsOrRepair('{"a":"one\ntwo"}'), { a: 'one\ntwo' });
});

test('surrounding whitespace is tolerated on the repair path', () => {
  assert.deepEqual(loadsOrRepair('  {"a":"one\ntwo"}  '), { a: 'one\ntwo' });
});

test('an object with a PROSE TAIL is refused — the whole text must be the object', () => {
  // Without this, handing a whole reply to the filter would let its first line parse as a tool call.
  assert.equal(loadsOrRepair('{"a":"one\ntwo"} and then prose'), null);
});

test('an object followed by another object is refused', () => {
  assert.equal(loadsOrRepair('{"a":"x\ny"}{"b":2}'), null);
});

test('unparseable text is null', () => {
  assert.equal(loadsOrRepair('not json'), null);
  assert.equal(loadsOrRepair(''), null);
  assert.equal(loadsOrRepair('{"a":1'), null);
});

test('a JSON null is indistinguishable from a parse failure', () => {
  // CURRENT BEHAVIOUR. Harmless where it is used — isRecord(null) is false either way — but pinned
  // so a future caller that treats null as "failed" knows it is also "succeeded with null".
  assert.equal(loadsOrRepair('null'), null);
});
