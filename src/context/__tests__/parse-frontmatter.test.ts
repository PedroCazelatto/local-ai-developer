// Pins the validating half of the standards catalog. Its rule is FAIL LOUD, NEVER SILENT, and the
// reason is asymmetric: a standard dropped from the catalog is one search_rules can never surface
// again, so an aborted boot naming the offending path is strictly better than a quiet omission.
// Every throw therefore has to keep throwing, and every message has to keep naming the file.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseFrontmatter } from '../parse-frontmatter.js';
import { StandardsCatalogError } from '../standards-catalog.js';

/** A file with `frontmatter` fenced above a body. */
function file(frontmatter: string, body = 'Body.\n'): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

const VALID = 'name: clean-architecture\ndescription: Use when structuring modules.';

// ======================================================================================= accepted

test('a well-formed block parses into an entry', () => {
  assert.deepEqual(parseFrontmatter(file(VALID), 'rules/standards/ca.md'), {
    name: 'clean-architecture',
    description: 'Use when structuring modules.',
  });
});

test('whitespace around keys and values is trimmed', () => {
  assert.deepEqual(parseFrontmatter(file('  name :  n  \n  description :  d  '), 'f.md'), {
    name: 'n',
    description: 'd',
  });
});

test('a description containing colons survives — only the FIRST colon splits', () => {
  const entry = parseFrontmatter(file('name: n\ndescription: Use when: A, B: C'), 'f.md');
  assert.equal(entry.description, 'Use when: A, B: C');
});

test('lines with no colon are ignored rather than fatal', () => {
  assert.deepEqual(parseFrontmatter(file('\nname: n\n# a comment\n\ndescription: d'), 'f.md'), {
    name: 'n',
    description: 'd',
  });
});

test('a colonless line cannot OVERWRITE a field that was set properly', () => {
  // The case above proves only that a stray line does not crash. It cannot prove the `continue`
  // guard does anything, because the junk key a dropped guard would produce ("# a commen") collides
  // with nothing. This one can: without the guard, a colonless line is stored under
  // line.slice(0, -1), so the bare word "namex" would claim the key "name" and win on Map ordering.
  assert.equal(parseFrontmatter(file('name: real\nnamex\ndescription: d'), 'f.md').name, 'real');
  assert.equal(
    parseFrontmatter(file('name: n\ndescription: real\ndescriptionx'), 'f.md').description,
    'real',
  );
});

test('extra keys are ignored', () => {
  assert.deepEqual(parseFrontmatter(file('name: n\ndescription: d\nversion: 3\nowner: x'), 'f.md'), {
    name: 'n',
    description: 'd',
  });
});

test('a duplicated key takes the LAST value', () => {
  // Map.set semantics. Pinned as CURRENT behaviour; splitFrontmatter takes the FIRST, so the two
  // parsers disagree on a file that repeats `name`. See the report.
  assert.equal(parseFrontmatter(file('name: first\nname: second\ndescription: d'), 'f.md').name, 'second');
});

test('the body below the fence is ignored entirely', () => {
  const entry = parseFrontmatter(file(VALID, 'name: not-this\ndescription: nor-this\n'), 'f.md');
  assert.equal(entry.name, 'clean-architecture');
});

test('CRLF frontmatter parses exactly like LF', () => {
  assert.deepEqual(parseFrontmatter('---\r\nname: n\r\ndescription: d\r\n---\r\nBody.\r\n', 'f.md'), {
    name: 'n',
    description: 'd',
  });
});

test('a closing fence with no trailing newline is accepted', () => {
  assert.deepEqual(parseFrontmatter('---\nname: n\ndescription: d\n---', 'f.md'), {
    name: 'n',
    description: 'd',
  });
});

// ========================================================================================= throws

test('a missing block throws, naming the file and what is needed', () => {
  assert.throws(
    () => parseFrontmatter('# No frontmatter here\n', 'rules/standards/bad.md'),
    (err: unknown) =>
      err instanceof StandardsCatalogError &&
      err.message.includes('rules/standards/bad.md') &&
      /Missing YAML frontmatter/.test(err.message),
  );
});

test('an unterminated fence counts as a missing block', () => {
  assert.throws(() => parseFrontmatter('---\nname: n\ndescription: d\n', 'f.md'), StandardsCatalogError);
});

test('a fence that does not start at byte zero counts as a missing block', () => {
  assert.throws(() => parseFrontmatter('intro\n---\nname: n\ndescription: d\n---\n', 'f.md'), StandardsCatalogError);
});

test('a missing name throws and says so', () => {
  assert.throws(
    () => parseFrontmatter(file('description: d'), 'rules/standards/bad.md'),
    (err: unknown) =>
      err instanceof StandardsCatalogError &&
      err.message.includes('rules/standards/bad.md') &&
      /missing a non-empty "name"/.test(err.message),
  );
});

test('an empty or whitespace-only name throws', () => {
  assert.throws(() => parseFrontmatter(file('name:\ndescription: d'), 'f.md'), /non-empty "name"/);
  assert.throws(() => parseFrontmatter(file('name:    \ndescription: d'), 'f.md'), /non-empty "name"/);
});

test('a missing description throws and says so', () => {
  assert.throws(
    () => parseFrontmatter(file('name: n'), 'rules/standards/bad.md'),
    (err: unknown) =>
      err instanceof StandardsCatalogError &&
      err.message.includes('rules/standards/bad.md') &&
      /missing a non-empty "description"/.test(err.message),
  );
});

test('an empty description throws', () => {
  assert.throws(() => parseFrontmatter(file('name: n\ndescription:'), 'f.md'), /non-empty "description"/);
});

test('name is checked before description, so the first fault reported is the first missing key', () => {
  assert.throws(() => parseFrontmatter(file('version: 1'), 'f.md'), /non-empty "name"/);
});

test('an empty block throws on the name', () => {
  assert.throws(() => parseFrontmatter('---\n\n---\n', 'f.md'), StandardsCatalogError);
});

// ============================================================================================ BOM

test('a UTF-8 BOM makes a valid file ABORT THE CATALOG', () => {
  // CURRENT BEHAVIOUR, and the sharper half of the BOM defect. ^--- does not tolerate a BOM, so a
  // standards file saved BOM-first — a routine thing for a Windows editor — throws "Missing YAML
  // frontmatter" against a file that visibly has one, and loadCatalog aborts boot. See the report.
  assert.throws(
    () => parseFrontmatter('﻿---\nname: n\ndescription: d\n---\nBody.\n', 'rules/standards/bom.md'),
    (err: unknown) => err instanceof StandardsCatalogError && /Missing YAML frontmatter/.test(err.message),
  );
});
