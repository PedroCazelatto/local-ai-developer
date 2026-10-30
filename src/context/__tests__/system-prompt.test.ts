// Pins buildSystemPrompt. Its output is what every phase actually says to the model on every turn,
// and a silent change to it would not surface until a live run — there is no type, no schema and no
// caller that would notice. So this file pins it in two layers:
//
//   1. ASSEMBLY — the block order, the exact separators, and the tail. Readable, and a failure here
//      names what moved.
//   2. A BYTE-FOR-BYTE DIGEST of the whole prompt for a fixed input. That is the tripwire: it catches
//      any edit to the two constant guidance blocks, including whitespace a reader would miss.
//      Editing the guidance on purpose is fine and expected — update the digest in the SAME commit,
//      and the diff then shows the prompt changed, which is the whole point.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Tool } from 'ollama';

import { buildSystemPrompt } from '../system-prompt.js';

function tool(name: string): Tool {
  return { type: 'function', function: { name } };
}

/** The fixed input the digest is taken over. Do not change it without recomputing the digest. */
const FIXED_TOOLS: readonly Tool[] = [tool('read_file')];
const fixedPrompt = (): string => buildSystemPrompt('PHASE.', FIXED_TOOLS, 'STATE.');

// ============================================================================ the byte-for-byte pin

test('the assembled prompt is byte-for-byte what it was when pinned', () => {
  // If this fails and you MEANT to change the prompt: run the same hash over the new output and
  // update the constant below in the same commit. If you did not mean to change it, something else
  // did — that is what this test is for.
  const digest = createHash('sha256').update(fixedPrompt(), 'utf8').digest('hex');
  assert.equal(digest, '0e78bcaf09a59a6c3dcd970e511c79d95611a3806c686e68a0e21110daeb1859');
});

test('the prompt is the length it was when pinned', () => {
  // A second, human-readable witness to the same fact: a digest mismatch alone does not say how big
  // the change was, and this does.
  assert.equal(fixedPrompt().length, 2897);
});

// ==================================================================================== assembly

test('the blocks appear in the pinned order', () => {
  const prompt = buildSystemPrompt('PHASE INSTRUCTIONS.', [tool('read_file')], 'PROJECT STATE.');
  const order = ['PHASE INSTRUCTIONS.', '# Your Tools', '# Tool Use', '# Your Output', '# Project Context'];
  let cursor = -1;
  for (const marker of order) {
    const at = prompt.indexOf(marker);
    assert.notEqual(at, -1, `${marker} is missing`);
    assert.ok(at > cursor, `${marker} is out of order`);
    cursor = at;
  }
});

test('the tool inventory sits BEFORE the mechanics — what exists, then how to call it', () => {
  const prompt = buildSystemPrompt('P.', [tool('read_file')], 'S.');
  assert.ok(prompt.indexOf('# Your Tools') < prompt.indexOf('# Tool Use'));
});

test('the phase instructions lead, verbatim and unwrapped', () => {
  assert.ok(buildSystemPrompt('DO THE THING.', [tool('a')], 'S.').startsWith('DO THE THING.\n\n'));
});

test('blocks are separated by exactly one blank line', () => {
  const prompt = buildSystemPrompt('P.', [tool('a')], 'S.');
  assert.match(prompt, /P\.\n\n# Your Tools/);
  assert.match(prompt, /- `a`\n\n# Tool Use/);
  assert.match(prompt, /\n\n# Your Output\n/);
  assert.match(prompt, /\n\n# Project Context\n/);
});

test('the project state is the tail, on its own line, with one closing newline', () => {
  const prompt = buildSystemPrompt('P.', [tool('a')], 'PROJECT STATE HERE');
  assert.ok(prompt.endsWith('# Project Context\nPROJECT STATE HERE\n'));
});

test('an empty project state still produces the heading and the closing newline', () => {
  assert.ok(buildSystemPrompt('P.', [tool('a')], '').endsWith('# Project Context\n\n'));
});

// ==================================================================== the tool inventory is live

test('the inventory is rendered from the array passed in, not from a constant', () => {
  const prompt = buildSystemPrompt('P.', [tool('alpha'), tool('beta')], 'S.');
  assert.match(prompt, /- `alpha`\n- `beta`/);
});

test('a window with no tools says so inside the prompt', () => {
  const prompt = buildSystemPrompt('P.', [], 'S.');
  assert.match(prompt, /# Your Tools\nThis window has no tools\./);
  assert.doesNotMatch(prompt, /- `/);
});

test('a tool NOT in the array cannot appear in the prompt', () => {
  // The drift this block exists to kill: a phase file naming a tool the window does not hold.
  const prompt = buildSystemPrompt('P.', [tool('read_file')], 'S.');
  assert.doesNotMatch(prompt, /write_file/);
});

// ======================================================= the clauses that must not silently vanish

test('the model is told its markdown is really rendered', () => {
  const prompt = buildSystemPrompt('P.', [tool('a')], 'S.');
  assert.match(prompt, /rendered as markdown in a color terminal/);
});

test('the model is forbidden from emitting ANSI or choosing a colour', () => {
  // The orchestrator owns every colour; a hallucinated escape must never be able to fight the theme.
  const prompt = buildSystemPrompt('P.', [tool('a')], 'S.');
  assert.match(prompt, /Write NO raw ANSI escape codes and no color names/);
  assert.match(prompt, /You do not choose colors/);
});

test('the model is forbidden from printing tool-call JSON as text', () => {
  // The failure mode StreamFilter and recoverToolCalls exist to clean up after.
  const prompt = buildSystemPrompt('P.', [tool('a')], 'S.');
  assert.match(prompt, /Do not print tool-call JSON as text in your reply/);
});

test('the model is told to act rather than promise', () => {
  assert.match(
    buildSystemPrompt('P.', [tool('a')], 'S.'),
    /Never describe or promise an action without performing it/,
  );
});

test('the model is told the user never sees tool results', () => {
  assert.match(buildSystemPrompt('P.', [tool('a')], 'S.'), /The user never sees tool results/);
});

test('the model is told not to paste file contents back', () => {
  assert.match(buildSystemPrompt('P.', [tool('a')], 'S.'), /NEVER paste a file's contents into your reply/);
});
