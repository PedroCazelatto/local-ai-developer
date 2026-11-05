// Pins the wording the read_file notice uses when the backstop cap fires. Since backlog item 7 that cap
// is in tokens and derived at runtime, so the notice must quote the cap THIS slice was rendered under —
// read off the slice, never off a constant — and name it in tokens.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatReadNotice } from '../format-read-notice.js';
import { renderNumberedSlice } from '../render-numbered-slice.js';

test('a token-cap cut quotes the slice\'s own cap, in tokens, and names the cut line', () => {
  const slice = renderNumberedSlice('z'.repeat(10_000), 0, null, 0, 1_170);
  assert.equal(slice.ok, true);
  if (!slice.ok) return;
  const notice = formatReadNotice(slice, 'big.min.js');
  assert.match(notice, /^\[truncated at the 1,170-token cap mid-line 1 — /);
  assert.match(notice, /char_offset: \d+/);
});

test('a different ceiling quotes a different cap', () => {
  const slice = renderNumberedSlice('z'.repeat(10_000), 0, null, 0, 585);
  assert.equal(slice.ok, true);
  if (!slice.ok) return;
  assert.match(formatReadNotice(slice, 'big.min.js'), /the 585-token cap/);
});
