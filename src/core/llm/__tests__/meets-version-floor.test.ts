// Pins the version comparison behind the boot floor. The 0.10 case is the whole reason this is a
// function and not an inline `>=`: '0.10.0' < '0.9.1' is TRUE as text, so a string compare would refuse
// every daemon in the 0.10–0.33 range — including the 0.33.2 this box actually runs.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { meetsVersionFloor } from '../meets-version-floor.js';

const FLOOR = '0.9.1';

test('exactly the floor passes', () => {
  assert.equal(meetsVersionFloor('0.9.1', FLOOR), 'ok');
});

test('one patch below the floor is refused', () => {
  assert.equal(meetsVersionFloor('0.9.0', FLOOR), 'below');
});

test('a HIGHER minor with a lower digit beats the floor — the string-compare trap', () => {
  // '0.10.0' < '0.9.1' lexicographically. Pin the trap itself so the reason this test exists survives.
  assert.equal('0.10.0' < FLOOR, true, 'the trap this exists to close');
  assert.equal(meetsVersionFloor('0.10.0', FLOOR), 'ok');
  assert.equal(meetsVersionFloor('0.12.5', FLOOR), 'ok');
  assert.equal(meetsVersionFloor('0.33.2', FLOOR), 'ok', 'the version this box reports');
});

test('the versions the floor was researched against land on the right side', () => {
  assert.equal(meetsVersionFloor('0.6.4', FLOOR), 'below', '/api/show had capabilities; /api/tags did not');
  assert.equal(meetsVersionFloor('0.8.0', FLOOR), 'below');
  assert.equal(meetsVersionFloor('0.9.2', FLOOR), 'ok');
  assert.equal(meetsVersionFloor('1.0.0', FLOOR), 'ok');
});

test('a missing segment reads as zero', () => {
  assert.equal(meetsVersionFloor('0.9', FLOOR), 'below', '0.9 is 0.9.0, below 0.9.1');
  assert.equal(meetsVersionFloor('1', FLOOR), 'ok');
  assert.equal(meetsVersionFloor('0', FLOOR), 'below');
});

test('a leading v is tolerated', () => {
  assert.equal(meetsVersionFloor('v0.9.1', FLOOR), 'ok');
  assert.equal(meetsVersionFloor('v0.8.9', FLOOR), 'below');
});

test('a suffix after the numeric triple is ignored', () => {
  assert.equal(meetsVersionFloor('0.9.1-rc1', FLOOR), 'ok');
  assert.equal(meetsVersionFloor('0.12.0-rc0', FLOOR), 'ok');
  assert.equal(meetsVersionFloor('0.9.0-rc9', FLOOR), 'below', 'the suffix does not lift a lower triple');
});

test('surrounding whitespace does not change the answer', () => {
  assert.equal(meetsVersionFloor('  0.9.1\n', FLOOR), 'ok');
});

test('nothing to compare is UNREADABLE, which is not a pass', () => {
  assert.equal(meetsVersionFloor(undefined, FLOOR), 'unreadable');
  assert.equal(meetsVersionFloor('', FLOOR), 'unreadable');
  assert.equal(meetsVersionFloor('unknown', FLOOR), 'unreadable');
  assert.equal(meetsVersionFloor('v', FLOOR), 'unreadable');
  assert.equal(meetsVersionFloor('.9.1', FLOOR), 'unreadable');
});

test('a segment with more digits still compares as a number', () => {
  assert.equal(meetsVersionFloor('0.100.0', FLOOR), 'ok');
  assert.equal(meetsVersionFloor('0.9.10', FLOOR), 'ok', 'patch 10 > patch 1');
});
