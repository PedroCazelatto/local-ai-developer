// Drives the probe cache as what it really is — a FILE — and proves the three properties the design
// rests on, end to end through the real reader and writer:
//
//   1. accumulation: write at ceiling A, write at ceiling B, and A's rows are still on disk;
//   2. the reset gesture: DELETING the file is safe at any moment and re-arms every probe;
//   3. a re-pulled digest re-probes, with nothing else disturbed.
//
// In scope for a test per constitution.md's *Testing* section, on the resolveInProject precedent: the
// filesystem is the thing under test, and no live model, container or terminal is involved.
//
// HOW THE HOME DIRECTORY IS REDIRECTED. appStateDir() resolves `~` through os.homedir(), which reads
// USERPROFILE on Windows and HOME elsewhere — verified against this Node build rather than assumed, so
// both are set and both are restored. Without that, this test would write into the developer's real
// ~/.local-ai-developer and its accumulation assertions would be reading somebody's actual machine.

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import type { InstalledModel } from '../../llm/list-models.js';
import { loadProbeCache } from '../load-probe-cache.js';
import { pendingProbes } from '../pending-probes.js';
import { probeCacheFile } from '../probe-cache-file.js';
import { probeCacheKey } from '../probe-cache-key.js';
import type { ProbeCache } from '../probe-cache.type.js';
import { saveProbeCache } from '../save-probe-cache.js';

const CEILING_A = 16384;
const CEILING_B = 32768;

const INSTALLED: readonly InstalledModel[] = [
  {
    name: 'qwen2.5-coder:14b',
    size: 8_988_124_298,
    modifiedAt: new Date('2026-08-01T12:00:00Z'),
    digest: '9ec8897f747e246e970bc5cfdda85d22f1123dc2e3d34978a010a75968716849',
    capabilities: ['completion', 'tools', 'insert'],
  },
  {
    name: 'codestral:22b',
    size: 12_569_170_438,
    modifiedAt: new Date('2026-08-01T12:00:00Z'),
    digest: '0898a8b286d56d8105587049fec69634fce83c957230fc13f0acfe03b7b11909',
    capabilities: ['completion', 'insert'],
  },
];

/** Run `body` with os.homedir() pointed at a fresh temp directory, restoring the environment after. */
function inTempHome(body: (home: string) => void): void {
  const home = mkdtempSync(path.join(os.tmpdir(), 'lad-probe-cache-'));
  const savedProfile = process.env['USERPROFILE'];
  const savedHome = process.env['HOME'];
  process.env['USERPROFILE'] = home;
  process.env['HOME'] = home;
  // The redirect is the precondition for every assertion below, so it is checked rather than trusted.
  assert.equal(os.homedir(), home, 'os.homedir() must follow the environment on this platform');
  assert.ok(probeCacheFile().startsWith(home), 'and the cache file must land inside it');
  try {
    body(home);
  } finally {
    if (savedProfile === undefined) delete process.env['USERPROFILE'];
    else process.env['USERPROFILE'] = savedProfile;
    if (savedHome === undefined) delete process.env['HOME'];
    else process.env['HOME'] = savedHome;
    // Cleanup is retried and non-fatal: a teardown that throws after the assertions passed would
    // score a green harness as a failure (the false-KILL shape).
    try {
      rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch {
      // A leftover temp directory is the OS's problem, not this test's verdict.
    }
  }
}

/** The rows a probe sweep at `numCtx` would have produced for every installed model. */
function measuredAt(numCtx: number): ProbeCache {
  const rows: Record<string, { weightsBytes: number; sizeVramBytes: number }> = {};
  for (const m of INSTALLED) {
    rows[probeCacheKey(m.digest, numCtx)] = {
      weightsBytes: m.size,
      sizeVramBytes: numCtx === CEILING_A ? 10_489_209_814 : 9_100_000_000,
    };
  }
  return rows;
}

test('an absent file reads as nothing measured, silently — the fresh-install case', () => {
  inTempHome(() => {
    assert.equal(existsSync(probeCacheFile()), false);
    assert.deepEqual(loadProbeCache(), {});
    assert.equal(pendingProbes(INSTALLED, loadProbeCache(), CEILING_A).length, 2);
  });
});

test('a saved sweep is readable back, and creates the directory on first write', () => {
  inTempHome((home) => {
    const returned = saveProbeCache(measuredAt(CEILING_A));
    assert.equal(existsSync(path.join(home, '.local-ai-developer')), true);
    assert.deepEqual(loadProbeCache(), measuredAt(CEILING_A));
    assert.deepEqual(returned, loadProbeCache(), 'the return value is what landed on disk');
    assert.deepEqual(pendingProbes(INSTALLED, loadProbeCache(), CEILING_A), []);
  });
});

test('THE ACCUMULATION PROPERTY, on disk: ceiling B is added and ceiling A survives', () => {
  inTempHome(() => {
    saveProbeCache(measuredAt(CEILING_A));
    assert.deepEqual(pendingProbes(INSTALLED, loadProbeCache(), CEILING_B).length, 2, 'B is unmeasured');

    saveProbeCache(measuredAt(CEILING_B));
    const both = loadProbeCache();
    assert.equal(Object.keys(both).length, 4, 'two models at two ceilings');
    assert.deepEqual(pendingProbes(INSTALLED, both, CEILING_B), [], 'B is measured now');
    assert.deepEqual(pendingProbes(INSTALLED, both, CEILING_A), [], 'AND GOING BACK TO A IS FREE');
    // The old rows are not merely present, they still hold the numbers they were measured with.
    assert.deepEqual(both, { ...measuredAt(CEILING_A), ...measuredAt(CEILING_B) });
  });
});

test('the file is plain JSON a human can read, and leaves no temp file behind', () => {
  inTempHome(() => {
    saveProbeCache(measuredAt(CEILING_A));
    const raw = readFileSync(probeCacheFile(), 'utf-8');
    assert.ok(raw.endsWith('\n'), 'newline-terminated like state.json');
    assert.deepEqual(JSON.parse(raw), measuredAt(CEILING_A));
    assert.equal(existsSync(`${probeCacheFile()}.tmp`), false, 'the temp file was renamed, not left');
  });
});

test('DELETING THE FILE IS THE RESET GESTURE, and it re-arms every probe', () => {
  inTempHome(() => {
    saveProbeCache(measuredAt(CEILING_A));
    saveProbeCache(measuredAt(CEILING_B));
    assert.equal(Object.keys(loadProbeCache()).length, 4);

    rmSync(probeCacheFile());

    assert.deepEqual(loadProbeCache(), {}, 'no measurement survives the delete');
    assert.equal(pendingProbes(INSTALLED, loadProbeCache(), CEILING_A).length, 2);
    assert.equal(pendingProbes(INSTALLED, loadProbeCache(), CEILING_B).length, 2);
    // And writing again after the delete works — the delete is not a state the writer cannot leave.
    saveProbeCache(measuredAt(CEILING_A));
    assert.deepEqual(pendingProbes(INSTALLED, loadProbeCache(), CEILING_A), []);
  });
});

test('A RE-PULLED DIGEST RE-PROBES, and nothing else is disturbed', () => {
  inTempHome(() => {
    saveProbeCache(measuredAt(CEILING_A));
    // Only the digest changes — same name, same size, same ceiling. That is what re-pulling a moving
    // tag does, and it is the one stale case a cache with no invalidation had to survive.
    const rePulled: readonly InstalledModel[] = [
      { ...INSTALLED[0]!, digest: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' },
      INSTALLED[1]!,
    ];
    const pending = pendingProbes(rePulled, loadProbeCache(), CEILING_A);
    assert.deepEqual(
      pending.map((m) => m.name),
      ['qwen2.5-coder:14b'],
    );
    // The row for the bytes that are gone stays on disk, harmless: nothing looks it up any more.
    assert.equal(Object.keys(loadProbeCache()).length, 2);
  });
});

test('a corrupt file reads as empty rather than crashing boot', () => {
  inTempHome((home) => {
    saveProbeCache(measuredAt(CEILING_A));
    writeFileSync(probeCacheFile(), '{ this is not json');
    // console.warn is expected here; the contract is that it returns rather than throws.
    assert.deepEqual(loadProbeCache(), {});
    assert.equal(pendingProbes(INSTALLED, loadProbeCache(), CEILING_A).length, 2);
    // And the next save replaces it, so a corrupt file is self-healing.
    saveProbeCache(measuredAt(CEILING_A));
    assert.deepEqual(loadProbeCache(), measuredAt(CEILING_A));
    assert.ok(probeCacheFile().startsWith(home));
  });
});

test('a hand-edited bad row drops itself and the rows beside it survive', () => {
  inTempHome(() => {
    const withJunk = { ...measuredAt(CEILING_A), 'hand@edited': { weightsBytes: 'lots' } };
    // saveProbeCache first, only to create ~/.local-ai-developer; the hand edit is what is under test.
    saveProbeCache({});
    writeFileSync(probeCacheFile(), `${JSON.stringify(withJunk, null, 2)}\n`);
    assert.equal(Object.keys(withJunk).length, 3, 'the file really does hold a bad row');
    assert.deepEqual(loadProbeCache(), measuredAt(CEILING_A));
  });
});

test('the cache lives beside state.json, not inside it', () => {
  inTempHome((home) => {
    const dir = path.join(home, '.local-ai-developer');
    assert.equal(probeCacheFile(), path.join(dir, 'vram-probes.json'));
    saveProbeCache(measuredAt(CEILING_A));
    // The reset gesture must not be able to take the user's model choice with it.
    assert.equal(existsSync(path.join(dir, 'state.json')), false);
  });
});
