// Pins resolveInProject — the path-escape boundary every host-side file tool is scoped by, and the
// only scoping the host-side git tools and the Retro single-file lock have at all. The happy path is
// the least interesting part of it, so most of what is pinned here is the ESCAPES:
//
//   - lexical escapes (`..`, an absolute path elsewhere);
//   - the sibling-prefix escape, which a naive startsWith(root) check lets straight through;
//   - the SYMLINK escape, which is why this function realpaths rather than resolving lexically —
//     execute_command can plant a link inside /workspace, and that link materializes inside the
//     project directory on the host.
//
// Real directories in the OS temp directory are unavoidable here: the function's whole job is to ask
// the filesystem what a path really points at. No Docker, no Ollama, no terminal.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { resolveInProject } from '../resolve-in-project.js';

/** A throwaway project directory plus its realpath — the temp dir is itself a symlink on macOS. */
interface Fixture {
  readonly root: string;
  readonly realRoot: string;
  readonly cleanup: () => void;
}

function fixture(): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), 'lad-proj-'));
  return {
    root,
    realRoot: realpathSync(root),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** A directory link, spelled the way each OS allows one without elevation. False when refused. */
function linkDir(target: string, link: string): boolean {
  try {
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch {
    return false;
  }
}

const ESCAPED = /escapes the project directory/;

// ==================================================================================== in-project

test('a relative path inside the project resolves under the project root', () => {
  const { root, realRoot, cleanup } = fixture();
  try {
    mkdirSync(path.join(root, 'src'));
    writeFileSync(path.join(root, 'src', 'a.ts'), '', 'utf-8');
    assert.equal(resolveInProject(root, 'src/a.ts'), path.join(realRoot, 'src', 'a.ts'));
  } finally {
    cleanup();
  }
});

test('the project root itself is allowed', () => {
  const { root, realRoot, cleanup } = fixture();
  try {
    assert.equal(resolveInProject(root, ''), realRoot);
    assert.equal(resolveInProject(root, '.'), realRoot);
  } finally {
    cleanup();
  }
});

test('a path whose leaf does not exist yet still validates', () => {
  // write_file names a path it is about to create; scoping has to happen before creation.
  const { root, realRoot, cleanup } = fixture();
  try {
    assert.equal(resolveInProject(root, 'nowhere/yet/a.ts'), path.join(realRoot, 'nowhere', 'yet', 'a.ts'));
  } finally {
    cleanup();
  }
});

test('an absolute path that happens to be inside the project is allowed', () => {
  const { root, realRoot, cleanup } = fixture();
  try {
    assert.equal(resolveInProject(root, path.join(root, 'a.ts')), path.join(realRoot, 'a.ts'));
  } finally {
    cleanup();
  }
});

test('a dot-segment path that stays inside is allowed', () => {
  const { root, realRoot, cleanup } = fixture();
  try {
    assert.equal(resolveInProject(root, 'src/../a.ts'), path.join(realRoot, 'a.ts'));
  } finally {
    cleanup();
  }
});

// ============================================================================== lexical escapes

test('a parent-directory path is refused', () => {
  const { root, cleanup } = fixture();
  try {
    assert.throws(() => resolveInProject(root, '..'), ESCAPED);
    assert.throws(() => resolveInProject(root, '../secrets.txt'), ESCAPED);
  } finally {
    cleanup();
  }
});

test('dot segments that climb out mid-path are refused', () => {
  const { root, cleanup } = fixture();
  try {
    assert.throws(() => resolveInProject(root, 'src/../../secrets.txt'), ESCAPED);
  } finally {
    cleanup();
  }
});

test('an absolute path outside the project is refused', () => {
  const { root, cleanup } = fixture();
  try {
    assert.throws(() => resolveInProject(root, tmpdir()), ESCAPED);
    assert.throws(() => resolveInProject(root, path.parse(root).root), ESCAPED);
  } finally {
    cleanup();
  }
});

test('the refusal names the path the caller asked for, so the model can act on it', () => {
  const { root, cleanup } = fixture();
  try {
    assert.throws(() => resolveInProject(root, '../secrets.txt'), /'\.\.\/secrets\.txt'/);
  } finally {
    cleanup();
  }
});

// ======================================================================== the sibling-prefix trap

test('a sibling directory whose name merely starts with the project name is refused', () => {
  // The guard is the appended separator: a bare startsWith(root) would admit "<root>-evil".
  const { root, cleanup } = fixture();
  const sibling = `${root}-evil`;
  try {
    mkdirSync(sibling);
    assert.throws(() => resolveInProject(root, path.join(sibling, 'a.ts')), ESCAPED);
    assert.throws(() => resolveInProject(root, `../${path.basename(sibling)}/a.ts`), ESCAPED);
  } finally {
    rmSync(sibling, { recursive: true, force: true });
    cleanup();
  }
});

// ============================================================================== symlink escapes

test('a symlink planted inside the project cannot present an outside directory as inside', (t) => {
  const { root, cleanup } = fixture();
  const outside = mkdtempSync(path.join(tmpdir(), 'lad-outside-'));
  try {
    if (!linkDir(outside, path.join(root, 'escape'))) {
      t.skip('this environment does not allow creating directory links');
      return;
    }
    writeFileSync(path.join(outside, 'secrets.txt'), 'x', 'utf-8');
    assert.throws(() => resolveInProject(root, 'escape/secrets.txt'), ESCAPED);
  } finally {
    rmSync(outside, { recursive: true, force: true });
    cleanup();
  }
});

test('a symlink escape is caught even when the leaf does not exist yet', (t) => {
  // The nearest EXISTING ancestor is the link itself, and resolving that is what closes the hole.
  const { root, cleanup } = fixture();
  const outside = mkdtempSync(path.join(tmpdir(), 'lad-outside-'));
  try {
    if (!linkDir(outside, path.join(root, 'escape'))) {
      t.skip('this environment does not allow creating directory links');
      return;
    }
    assert.throws(() => resolveInProject(root, 'escape/not-created-yet.txt'), ESCAPED);
  } finally {
    rmSync(outside, { recursive: true, force: true });
    cleanup();
  }
});

test('a symlink that points back inside the project is allowed, and resolves to its target', (t) => {
  const { root, realRoot, cleanup } = fixture();
  try {
    mkdirSync(path.join(root, 'real'));
    if (!linkDir(path.join(root, 'real'), path.join(root, 'alias'))) {
      t.skip('this environment does not allow creating directory links');
      return;
    }
    assert.equal(resolveInProject(root, 'alias/a.ts'), path.join(realRoot, 'real', 'a.ts'));
  } finally {
    cleanup();
  }
});

// ============================================================================= root normalisation

test('a project root given through a symlink is normalised before comparing', (t) => {
  // Both sides go through realpath: comparing a real path against a lexical one is meaningless.
  const { root, realRoot, cleanup } = fixture();
  const aliasParent = mkdtempSync(path.join(tmpdir(), 'lad-alias-'));
  const alias = path.join(aliasParent, 'project');
  try {
    if (!linkDir(root, alias)) {
      t.skip('this environment does not allow creating directory links');
      return;
    }
    assert.equal(resolveInProject(alias, 'a.ts'), path.join(realRoot, 'a.ts'));
    assert.throws(() => resolveInProject(alias, '../secrets.txt'), ESCAPED);
  } finally {
    rmSync(aliasParent, { recursive: true, force: true });
    cleanup();
  }
});
