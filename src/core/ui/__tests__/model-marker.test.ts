// Pins the marker column: the precedence between the two markers, the direction each one fails in,
// and the width arithmetic that decided there is one column rather than two.
//
// The last of those is the unusual one, so the reason it is a test: the composition was chosen because
// appending both markers puts `/models list` at 83 columns on the machine this repo is built for, and
// that fact only stays true while the two spellings stay short. Widening either one silently is
// exactly how the toolless legend reached 95 characters before it was cut. The arithmetic is asserted
// here so a widening shows up as a failing test rather than as a wrapped row.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { VramMeasurement } from '../../llm/vram-measurement.type.js';
import { modelMarker } from '../model-marker.js';
import { NO_TOOLS_MARKER } from '../no-tools-marker.js';
import { TOO_HEAVY_MARKER } from '../too-heavy-marker.js';

const CAPABLE = ['completion', 'tools', 'insert'];
const TOOLLESS = ['completion', 'insert'];

// The two live measurements, from Ollama 0.33.2 at num_ctx 16384.
const RESIDENT: VramMeasurement = { weightsBytes: 8_988_124_298, sizeVramBytes: 10_489_209_814 };
const NOT_RESIDENT: VramMeasurement = { weightsBytes: 12_569_170_438, sizeVramBytes: 10_702_249_000 };

test('a capable model whose weights fit says nothing', () => {
  assert.equal(modelMarker(CAPABLE, RESIDENT), '');
});

test('a capable model whose weights do not fit is marked too heavy', () => {
  assert.equal(modelMarker(CAPABLE, NOT_RESIDENT), TOO_HEAVY_MARKER);
});

test('a toolless model is marked no-tools whatever its weights did', () => {
  // codestral:22b on this box is BOTH — no `tools`, and ~1.9 GB of weights on the CPU. The refusal is
  // the note that matters, because there is no choice left for the other note to inform.
  assert.equal(modelMarker(TOOLLESS, NOT_RESIDENT), NO_TOOLS_MARKER);
  assert.equal(modelMarker(TOOLLESS, RESIDENT), NO_TOOLS_MARKER);
  assert.equal(modelMarker(TOOLLESS, undefined), NO_TOOLS_MARKER);
});

test('an unreadable capability list fails CLOSED — no tools', () => {
  assert.equal(modelMarker([], undefined), NO_TOOLS_MARKER);
  assert.equal(modelMarker([], RESIDENT), NO_TOOLS_MARKER);
});

test('an unmeasured capable model fails OPEN — no marker at all', () => {
  // The opposite direction from the gate above, and deliberately so: this marker cannot refuse
  // anything, so a claim with nothing behind it would be worse than saying nothing.
  assert.equal(modelMarker(CAPABLE, undefined), '');
});

test('exactly one marker is ever returned, never both', () => {
  const inputs: Array<readonly [readonly string[], VramMeasurement | undefined]> = [
    [CAPABLE, RESIDENT],
    [CAPABLE, NOT_RESIDENT],
    [CAPABLE, undefined],
    [TOOLLESS, RESIDENT],
    [TOOLLESS, NOT_RESIDENT],
    [TOOLLESS, undefined],
    [[], undefined],
  ];
  for (const [capabilities, measurement] of inputs) {
    const marker = modelMarker(capabilities, measurement);
    assert.ok(
      marker === '' || marker === NO_TOOLS_MARKER || marker === TOO_HEAVY_MARKER,
      `unexpected marker: ${JSON.stringify(marker)}`,
    );
  }
});

test('the two markers are distinct spellings, so a legend count cannot double-count', () => {
  assert.notEqual(NO_TOOLS_MARKER, TOO_HEAVY_MARKER);
});

test('the width arithmetic behind ONE marker column, not two', () => {
  // `/models list` before the marker column, on the box this repo is built for:
  //   2 leading spaces + 1 active bullet + 1 space + a 21-char name (deepseek-coder-v2:16b)
  //   + 3 + a 9-char right-aligned size + 3 + a 16-char `YYYY-MM-DD HH:mm` timestamp.
  const rowBeforeMarker = 2 + 1 + 1 + 21 + 3 + 9 + 3 + 16;
  assert.equal(rowBeforeMarker, 56);
  const gap = 3;
  assert.ok(rowBeforeMarker + gap + NO_TOOLS_MARKER.length <= 80, '(no tools) alone fits 80 columns');
  assert.ok(rowBeforeMarker + gap + TOO_HEAVY_MARKER.length <= 80, '(too heavy) alone fits 80');
  // And the rejected composition, which is why precedence exists at all.
  assert.ok(
    rowBeforeMarker + gap + NO_TOOLS_MARKER.length + gap + TOO_HEAVY_MARKER.length > 80,
    'both markers on one row would wrap an 80-column terminal',
  );
  // Even closing the gap between them to a single space does not rescue it.
  assert.ok(rowBeforeMarker + gap + NO_TOOLS_MARKER.length + 1 + TOO_HEAVY_MARKER.length > 80);
});
