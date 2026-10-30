// Pins the read half of load_rule. It answers two questions about one standards file: what `name`
// does its frontmatter claim, and what is the body underneath. The name is what the slug is matched
// against — the slug is NOT the filename (clean-architecture <-> clean_architecture.md) — so a name
// this fails to extract is a standard the model can never load, silently.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { splitFrontmatter } from '../split-frontmatter.js';

/** A file with `frontmatter` fenced above `body`. */
function file(frontmatter: string, body = 'The body.\n'): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

// ======================================================================================== the name

test('the name is read out of the frontmatter', () => {
  assert.deepEqual(splitFrontmatter(file('name: clean-architecture')), {
    name: 'clean-architecture',
    body: 'The body.\n',
  });
});

test('surrounding whitespace around the key and the value is trimmed', () => {
  assert.equal(splitFrontmatter(file('   name  :   clean-architecture   ')).name, 'clean-architecture');
});

test('the name is found among other keys, in any position', () => {
  assert.equal(splitFrontmatter(file('description: d\nname: x\nversion: 2')).name, 'x');
});

test('a value containing a colon survives — only the FIRST colon splits', () => {
  assert.equal(splitFrontmatter(file('name: a:b:c')).name, 'a:b:c');
});

test('the first name key wins', () => {
  assert.equal(splitFrontmatter(file('name: first\nname: second')).name, 'first');
});

test('a key that merely CONTAINS "name" is not the name key', () => {
  assert.equal(splitFrontmatter(file('filename: x.md\nnickname: y')).name, '');
});

test('no name key yields an empty name, which simply matches nothing', () => {
  assert.equal(splitFrontmatter(file('description: only this')).name, '');
});

test('an empty name value yields an empty name', () => {
  assert.equal(splitFrontmatter(file('name:')).name, '');
});

// ======================================================================================== the body

test('the frontmatter block is dropped from the body', () => {
  assert.equal(splitFrontmatter(file('name: x')).body, 'The body.\n');
});

test('blank lines between the fence and the first content line are dropped', () => {
  assert.equal(splitFrontmatter(file('name: x', '\n\n\n# Heading\n')).body, '# Heading\n');
});

test('leading indentation on the first content line is preserved', () => {
  assert.equal(splitFrontmatter(file('name: x', '    indented\n')).body, '    indented\n');
});

test('the body is otherwise verbatim, including its own --- rules', () => {
  const body = '# Title\n\ntext\n\n---\n\nmore text\n';
  assert.equal(splitFrontmatter(file('name: x', body)).body, body);
});

test('an empty body is empty, not undefined', () => {
  assert.equal(splitFrontmatter(file('name: x', '')).body, '');
});

// ===================================================================================== no fence

test('a file with no frontmatter yields an empty name and the whole text as body', () => {
  const raw = '# Just a body\n\nno frontmatter.\n';
  assert.deepEqual(splitFrontmatter(raw), { name: '', body: raw });
});

test('a fence that does not start at byte zero is not frontmatter', () => {
  const raw = 'intro\n---\nname: x\n---\nbody\n';
  assert.deepEqual(splitFrontmatter(raw), { name: '', body: raw });
});

test('an unterminated fence is not frontmatter', () => {
  const raw = '---\nname: x\n\n# Body\n';
  assert.deepEqual(splitFrontmatter(raw), { name: '', body: raw });
});

test('the empty string is handled', () => {
  assert.deepEqual(splitFrontmatter(''), { name: '', body: '' });
});

// ================================================================================ line endings

test('CRLF frontmatter parses exactly like LF', () => {
  assert.deepEqual(splitFrontmatter('---\r\nname: x\r\n---\r\nThe body.\r\n'), {
    name: 'x',
    body: 'The body.\r\n',
  });
});

test('CRLF blank lines after the fence are only PARTLY dropped', () => {
  // CURRENT BEHAVIOUR, and an asymmetry. The stripper is /^\r?\n+/ — one optional \r, then a run of
  // \n. Against \r\n\r\n it consumes the first \r\n and then stops, because the next character is \r
  // rather than \n. So an LF file loses every leading blank line and a CRLF file loses one.
  // Latent today: none of the nine rules/standards files has a blank line after its fence, though
  // all nine are CRLF. /^(?:\r?\n)+/ is the shape that would treat both alike. See the report.
  assert.equal(splitFrontmatter('---\r\nname: x\r\n---\r\n\r\n\r\n# H\r\n').body, '\r\n# H\r\n');
  assert.equal(splitFrontmatter('---\nname: x\n---\n\n\n# H\n').body, '# H\n', 'the LF path strips all');
});

// ========================================================================================== BOM

test('a UTF-8 BOM defeats the fence entirely', () => {
  // CURRENT BEHAVIOUR, and a defect. The regex is anchored with ^--- and does not tolerate a BOM,
  // so a standards file saved BOM-first yields name '' — the slug can never match it, and the raw
  // --- block is handed to the model as part of the body. backlog.ts's splitFrontmatter DOES
  // tolerate a BOM (/^﻿?---/), so the repo disagrees with itself. See the report.
  const raw = '﻿---\nname: x\n---\nThe body.\n';
  assert.deepEqual(splitFrontmatter(raw), { name: '', body: raw });
});
