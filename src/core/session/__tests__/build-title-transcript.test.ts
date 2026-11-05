// Pins the title writer's transcript under the token budget backlog item 7 gave it. The invariants:
// whole turns only, from the HEAD, while they fit; the truncation notice whenever a turn was left out;
// and an opening turn larger than the whole budget still yields its head rather than nothing.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { estimateTokens } from '../../llm/estimate-tokens.js';
import { buildTitleTranscript, TRUNCATION_NOTICE } from '../build-title-transcript.js';
import type { MemoryRecord } from '../memory-record.type.js';

const PREFIX = 'Write the title for this conversation:\n\n';

function turn(seq: number, role: 'user' | 'assistant', content: string): MemoryRecord {
  return { seq, ts: '2026-11-05T00:00:00.000Z', role, content, tokens: { prompt: null, completion: null } };
}

test('turns that fit are all kept, with no notice', () => {
  const out = buildTitleTranscript([turn(1, 'user', 'hi'), turn(2, 'assistant', 'hello')], 1_365);
  assert.equal(out, `${PREFIX}[user]\nhi\n\n[assistant]\nhello`);
});

test('the budget keeps whole turns from the head, within its estimate, and says it cut', () => {
  const records = [1, 2, 3, 4].map((n) => turn(n, n % 2 === 1 ? 'user' : 'assistant', String(n).repeat(30)));
  const out = buildTitleTranscript(records, 20); // 80 characters' worth
  assert.ok(out.endsWith(TRUNCATION_NOTICE));
  const body = out.slice(PREFIX.length, out.length - TRUNCATION_NOTICE.length);
  assert.ok(estimateTokens(body) <= 20, `${body.length} chars fit 20 tokens`);
  // The opening turn (37 chars) fits; the second would take the total to 81, so it is dropped WHOLE
  // rather than cut to the 43 characters that remain.
  assert.equal(body, `[user]\n${'1'.repeat(30)}`);
});

test('an opening turn larger than the whole budget yields its head', () => {
  const out = buildTitleTranscript([turn(1, 'user', 'q'.repeat(500)), turn(2, 'assistant', 'a')], 10);
  const body = out.slice(PREFIX.length, out.length - TRUNCATION_NOTICE.length);
  assert.equal(body, `[user]\n${'q'.repeat(40 - '[user]\n'.length)}`);
});
