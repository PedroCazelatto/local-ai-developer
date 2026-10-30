// Pins the `/api/ps` narrowing, and the reason it exists at all: the pinned `ollama` package DECLARES
// `size_vram: number` on the one row type it uses for both `/api/tags` and `/api/ps`, and `/api/tags`
// actually sends nothing there. Both real rows below were captured from the live daemon — the /api/tags
// one is the counter-example that makes the declared type untrustworthy, so it is a fixture rather than
// a note.
//
// The other invariant here is that UNKNOWN IS NOT ZERO. Zero VRAM is a real, meaningful measurement
// (every weight byte on the CPU); an unreadable field is the absence of one. Collapsing them would
// invent the strongest possible "too heavy" verdict out of a daemon that said nothing.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSizeVram } from '../read-size-vram.js';

// Captured verbatim from `/api/ps` on Ollama 0.33.2 with qwen2.5-coder:14b loaded at num_ctx 16384.
const LIVE_PS_ROW = {
  name: 'qwen2.5-coder:14b',
  model: 'qwen2.5-coder:14b',
  size: 12_415_160_809,
  digest: '9ec8897f747e246e970bc5cfdda85d22f1123dc2e3d34978a010a75968716849',
  details: {
    parent_model: '',
    format: 'gguf',
    family: 'qwen2',
    families: ['qwen2'],
    parameter_size: '14.8B',
    quantization_level: 'Q4_K_M',
  },
  expires_at: '2026-09-02T16:08:37.2685396-03:00',
  size_vram: 10_489_209_814,
  context_length: 16384,
};

// The same model's `/api/tags` row, same daemon, same session: `size_vram` is absent even though the
// package's type says it is a number.
const LIVE_TAGS_ROW = {
  name: 'qwen2.5-coder:14b',
  model: 'qwen2.5-coder:14b',
  modified_at: '2026-08-01T12:00:00.000Z',
  size: 8_988_124_298,
  digest: '9ec8897f747e246e970bc5cfdda85d22f1123dc2e3d34978a010a75968716849',
};

test('a real /api/ps row yields the bytes the daemon reported', () => {
  assert.equal(readSizeVram(LIVE_PS_ROW), 10_489_209_814);
});

test('a real /api/tags row yields undefined — the declared type is not evidence', () => {
  assert.equal(readSizeVram(LIVE_TAGS_ROW), undefined);
  // And the field really is missing rather than zero, which is what makes this the right answer.
  assert.equal('size_vram' in LIVE_TAGS_ROW, false);
});

test('zero is a measurement, not an absence — every weight byte on the CPU', () => {
  assert.equal(readSizeVram({ size_vram: 0 }), 0);
});

test('a non-numeric field is unreadable rather than coerced', () => {
  assert.equal(readSizeVram({ size_vram: '10489209814' }), undefined);
  assert.equal(readSizeVram({ size_vram: true }), undefined);
  assert.equal(readSizeVram({ size_vram: null }), undefined);
  assert.equal(readSizeVram({ size_vram: { bytes: 10 } }), undefined);
});

test('NaN and Infinity are not bytes', () => {
  assert.equal(readSizeVram({ size_vram: Number.NaN }), undefined);
  assert.equal(readSizeVram({ size_vram: Number.POSITIVE_INFINITY }), undefined);
  assert.equal(readSizeVram({ size_vram: Number.NEGATIVE_INFINITY }), undefined);
});

test('a negative byte count is rejected rather than compared', () => {
  assert.equal(readSizeVram({ size_vram: -1 }), undefined);
});

test('a row that is not a record answers undefined instead of throwing', () => {
  assert.equal(readSizeVram(undefined), undefined);
  assert.equal(readSizeVram(null), undefined);
  assert.equal(readSizeVram(42), undefined);
  assert.equal(readSizeVram('size_vram'), undefined);
  // An array is not a record — isRecord excludes it, so `in`/index lookups cannot answer by position.
  assert.equal(readSizeVram([{ size_vram: 5 }]), undefined);
});
