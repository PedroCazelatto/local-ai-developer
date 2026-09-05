// Pins the "# Your Tools" block. This exists because the hand-written tool inventories in the phase
// files drifted three separate times, and the fix was structural: the block is rendered from the SAME
// Tool[] the window hands Ollama, so it cannot describe a surface the model does not hold. These
// tests pin the two halves of that guarantee — every name in the array is listed, and nothing that is
// not in the array can appear.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Tool } from 'ollama';

import { buildToolSection } from '../build-tool-section.js';

/** A Tool carrying only what the block reads; the schema half is irrelevant here. */
function tool(name?: string): Tool {
  return { type: 'function', function: name === undefined ? {} : { name } };
}

const HEADING = '# Your Tools';
const LEAD =
  'These are the only tools that exist, and all of them work right now. Any other name returns an ' +
  'error. Your phase instructions decide when to use each one.';
const NO_TOOLS = `${HEADING}\nThis window has no tools. Answer from what you already know.`;

// ================================================================================ the rendered list

test('one tool renders as heading, lead, blank line, then a backticked bullet', () => {
  assert.equal(buildToolSection([tool('read_file')]), `${HEADING}\n${LEAD}\n\n- \`read_file\``);
});

test('several tools each get their own bullet', () => {
  const section = buildToolSection([tool('a'), tool('b'), tool('c')]);
  assert.equal(section, `${HEADING}\n${LEAD}\n\n- \`a\`\n- \`b\`\n- \`c\``);
});

test('the array order is preserved, so related tools stay adjacent in the prompt', () => {
  const section = buildToolSection([tool('zebra'), tool('apple'), tool('mango')]);
  assert.match(section, /- `zebra`\n- `apple`\n- `mango`/);
});

test('the block ends without a trailing newline — the caller owns the separators', () => {
  assert.doesNotMatch(buildToolSection([tool('a')]), /\n$/);
});

// ================================================================== every name, and only those names

test('every name in the array appears', () => {
  const names = ['read_file', 'write_file', 'list_files', 'search_in_files', 'commit_changes'];
  const section = buildToolSection(names.map(tool));
  for (const name of names) assert.match(section, new RegExp(`- \`${name}\``));
});

test('the bullet count equals the tool count — nothing invented, nothing dropped', () => {
  const section = buildToolSection([tool('a'), tool('b'), tool('c')]);
  assert.equal(section.split('\n').filter((line) => line.startsWith('- ')).length, 3);
});

test('descriptions are NOT rendered, deliberately', () => {
  // The full description already rides in the `tools` array on the same request; repeating it here
  // would pay for the same text twice on a VRAM-bound box.
  const withDescription: Tool = {
    type: 'function',
    function: { name: 'read_file', description: 'READ THE FILE AT THE GIVEN PATH' },
  };
  const section = buildToolSection([withDescription]);
  assert.doesNotMatch(section, /READ THE FILE/);
  assert.match(section, /- `read_file`/);
});

// ================================================================================ nameless entries

test('a nameless tool is skipped — the model cannot call what it cannot name', () => {
  assert.equal(buildToolSection([tool('a'), tool(), tool('b')]), `${HEADING}\n${LEAD}\n\n- \`a\`\n- \`b\``);
});

test('an empty or whitespace-only name is skipped too', () => {
  assert.equal(buildToolSection([tool('a'), tool(''), tool('   ')]), `${HEADING}\n${LEAD}\n\n- \`a\``);
});

// ===================================================================================== no tools

test('an empty array states the fact instead of rendering an empty heading', () => {
  // A heading with a silent gap under it reads as "the list failed to load", to a model and a human.
  assert.equal(buildToolSection([]), NO_TOOLS);
});

test('an array whose every entry is nameless falls back to the same statement', () => {
  assert.equal(buildToolSection([tool(), tool(''), tool('  ')]), NO_TOOLS);
});

test('the no-tools branch carries no bullet and no lead', () => {
  const section = buildToolSection([]);
  assert.doesNotMatch(section, /- `/);
  assert.doesNotMatch(section, /Any other name returns an error/);
});
