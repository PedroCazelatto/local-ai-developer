// Pins the cache key, which is where "never invalidate" is either correct or a bug.
//
// Two properties carry the whole design: the model half is the DIGEST (so a tag re-pulled as different
// bytes is a key nobody has seen, and re-probes on its own), and the ceiling is part of the key (so a
// verdict is always a verdict about a num_ctx). The digest comes back from `/api/tags` as BARE HEX with
// no `sha256:` prefix — measured live, and pinned here so nothing starts stripping a prefix that was
// never sent.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { probeCacheKey } from '../probe-cache-key.js';

// A real digest from `/api/tags` on this box (qwen2.5-coder:14b): 64 hex characters, no prefix.
const DIGEST = '9ec8897f747e246e970bc5cfdda85d22f1123dc2e3d34978a010a75968716849';
const OTHER_DIGEST = '0898a8b286d56d8105587049fec69634fce83c957230fc13f0acfe03b7b11909';

test('the key is the digest and the ceiling, and carries the digest whole', () => {
  const key = probeCacheKey(DIGEST, 16384);
  assert.equal(key, `${DIGEST}@16384`);
  assert.ok(key.includes(DIGEST), 'the digest is never truncated — it is an identity');
  assert.equal(key.startsWith('sha256:'), false, '/api/tags sends bare hex; nothing adds a prefix');
});

test('a re-pulled tag is a key nobody has seen — the same name, different bytes', () => {
  assert.notEqual(probeCacheKey(DIGEST, 16384), probeCacheKey(OTHER_DIGEST, 16384));
});

test('the same model at two ceilings is two keys', () => {
  assert.notEqual(probeCacheKey(DIGEST, 16384), probeCacheKey(DIGEST, 32768));
});

test('the same pair is always the same key', () => {
  assert.equal(probeCacheKey(DIGEST, 16384), probeCacheKey(DIGEST, 16384));
});

test('distinct pairs cannot collide on one key', () => {
  // The separator is a character neither half can contain: a digest is hex, a ceiling is digits. So
  // no re-splitting of the same characters produces the same key.
  const keys = new Set([
    probeCacheKey('abc', 1),
    probeCacheKey('abc', 11),
    probeCacheKey('abc1', 1),
    probeCacheKey('ab', 1),
    probeCacheKey('ab', 11),
  ]);
  assert.equal(keys.size, 5);
});
