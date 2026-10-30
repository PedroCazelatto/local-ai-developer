// Pins the whole of backlog item 6's boot rule. The regression cases are the reason the file exists:
// `pickSmallestModel` sorted the installed set on disk bytes and took the smallest, which on this box
// was deepseek-coder-v2:16b — `completion,insert`, no tools, and structurally unable to run any phase.
// There were NO tests on the boot pick before this one.
//
// Fixtures are models measured on the live daemon, with their real capabilities and sizes, so a case
// here describes a machine that actually exists.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { InstalledModel } from '../../llm/list-models.js';
import { bootModelPlan } from '../boot-model-plan.js';

function model(name: string, size: number, capabilities: readonly string[]): InstalledModel {
  return { name, size, modifiedAt: new Date('2026-08-01T12:00:00Z'), digest: `digest-${name}`, capabilities };
}

// Toolless, and the SMALLEST thing on the box — the exact pick the deleted rule used to make.
const DEEPSEEK_CODER = model('deepseek-coder-v2:16b', 8_905_126_121, ['completion', 'insert']);
const DEEPSEEK_R1 = model('deepseek-r1:14b', 8_988_112_040, ['completion', 'thinking']);
const CODESTRAL = model('codestral:22b', 12_569_170_000, ['completion', 'insert']);
const QWEN_14B = model('qwen2.5-coder:14b', 8_988_112_041, ['completion', 'tools', 'insert']);
const QWEN3_CODER = model('qwen3-coder:30b', 18_564_000_000, ['completion', 'tools']);
const GPT_OSS = model('gpt-oss:20b', 13_790_000_000, ['completion', 'tools', 'thinking']);

/** listModels returns name-sorted, so fixtures mirroring a real list are sorted too. */
const THIS_BOX: readonly InstalledModel[] = [
  CODESTRAL,
  DEEPSEEK_CODER,
  DEEPSEEK_R1,
  GPT_OSS,
  QWEN_14B,
  QWEN3_CODER,
];

test('a saved model that is installed and tool-capable wins with no prompt', () => {
  const plan = bootModelPlan(THIS_BOX, 'qwen2.5-coder:14b');
  assert.equal(plan.outcome, 'saved');
  assert.equal(plan.outcome === 'saved' ? plan.name : undefined, 'qwen2.5-coder:14b');
  assert.equal(plan.refused, undefined);
});

test('a saved model that is installed but TOOLLESS is refused, and boot falls through to the list', () => {
  const plan = bootModelPlan(THIS_BOX, 'codestral:22b');
  assert.equal(plan.outcome, 'choose');
  assert.deepEqual(plan.refused, { savedName: 'codestral:22b', reason: 'toolless' });
});

test('a saved model that is NOT installed falls through — there is no re-pull offer any more', () => {
  const plan = bootModelPlan(THIS_BOX, 'llama3:70b');
  assert.equal(plan.outcome, 'choose');
  assert.deepEqual(plan.refused, { savedName: 'llama3:70b', reason: 'missing' });
});

test('the refusal distinguishes gone-from-the-disk from cannot-call-tools', () => {
  // Same outcome, different diagnosis — the whole reason `reason` is carried rather than a boolean.
  assert.equal(bootModelPlan(THIS_BOX, 'llama3:70b').refused?.reason, 'missing');
  assert.equal(bootModelPlan(THIS_BOX, 'deepseek-r1:14b').refused?.reason, 'toolless');
});

test('a saved model with no tag matches the implicit :latest form', () => {
  const installed = [model('mistral:latest', 4_000_000_000, ['completion', 'tools'])];
  const plan = bootModelPlan(installed, 'mistral');
  assert.equal(plan.outcome, 'saved');
  // The name comes back as SAVED, not as the daemon spells it — Ollama resolves the tagless form the
  // same way, and rewriting the user's own choice is not this function's job.
  assert.equal(plan.outcome === 'saved' ? plan.name : undefined, 'mistral');
});

test('a saved model with no tag is still gated on capability', () => {
  const installed = [model('mistral:latest', 4_000_000_000, ['completion'])];
  assert.deepEqual(bootModelPlan(installed, 'mistral').refused, { savedName: 'mistral', reason: 'toolless' });
});

test('with no saved model at all, the user is asked — nothing is inferred', () => {
  const plan = bootModelPlan(THIS_BOX, undefined);
  assert.equal(plan.outcome, 'choose');
  assert.equal(plan.refused, undefined, 'nothing was refused: there was nothing saved');
});

test('only tool-capable models are selectable, and the toolless ones are not among them', () => {
  const plan = bootModelPlan(THIS_BOX, undefined);
  assert.equal(plan.outcome, 'choose');
  const selectable = plan.outcome === 'choose' ? plan.selectable.map((m) => m.name) : [];
  assert.deepEqual(selectable, ['gpt-oss:20b', 'qwen2.5-coder:14b', 'qwen3-coder:30b']);
  for (const toolless of ['codestral:22b', 'deepseek-coder-v2:16b', 'deepseek-r1:14b']) {
    assert.equal(selectable.includes(toolless), false, toolless);
  }
});

test('selectable keeps listModels order rather than re-sorting on anything', () => {
  const plan = bootModelPlan([QWEN3_CODER, QWEN_14B, GPT_OSS], undefined);
  assert.deepEqual(
    plan.outcome === 'choose' ? plan.selectable.map((m) => m.name) : [],
    ['qwen3-coder:30b', 'qwen2.5-coder:14b', 'gpt-oss:20b'],
    'the caller sorted; nothing here re-orders, least of all by size',
  );
});

test('REGRESSION: the smallest installed model is never the pick', () => {
  // The deleted rule would have returned deepseek-coder-v2:16b here — the smallest on disk and
  // toolless. Nothing now hands back a model the user was not asked about.
  const plan = bootModelPlan(THIS_BOX, undefined);
  assert.notEqual(plan.outcome, 'saved');
  assert.equal(plan.outcome === 'choose' ? plan.selectable.includes(DEEPSEEK_CODER) : true, false);
});

test('REGRESSION: even an all-capable machine is asked rather than sized', () => {
  const plan = bootModelPlan([QWEN_14B, QWEN3_CODER], undefined);
  assert.equal(plan.outcome, 'choose');
  assert.equal(plan.outcome === 'choose' ? plan.selectable.length : 0, 2, 'both offered, neither picked');
});

test('nothing installed at all is its own outcome — recommend, and pull nothing', () => {
  const plan = bootModelPlan([], undefined);
  assert.equal(plan.outcome, 'empty');
  assert.equal(plan.refused, undefined);
});

test('a saved model on an empty machine reports both facts', () => {
  const plan = bootModelPlan([], 'qwen2.5-coder:14b');
  assert.equal(plan.outcome, 'empty');
  assert.deepEqual(plan.refused, { savedName: 'qwen2.5-coder:14b', reason: 'missing' });
});

test('models installed but none tool-capable boots model-less', () => {
  const plan = bootModelPlan([CODESTRAL, DEEPSEEK_CODER, DEEPSEEK_R1], undefined);
  assert.equal(plan.outcome, 'none-capable');
});

test('a saved toolless model on an all-toolless machine is refused AND boots model-less', () => {
  const plan = bootModelPlan([CODESTRAL, DEEPSEEK_CODER], 'codestral:22b');
  assert.equal(plan.outcome, 'none-capable');
  assert.deepEqual(plan.refused, { savedName: 'codestral:22b', reason: 'toolless' });
});

test('an EMPTY capability list fails closed — an unreadable field is an incapable model', () => {
  // What a daemon older than 0.9.1 reports for everything. Boot refuses such a daemon outright
  // (src/boot/ollama-version-refusal.ts), so this is the backstop — but the direction still has to hold.
  const blind = [model('qwen2.5-coder:14b', 8_988_112_041, []), model('gpt-oss:20b', 13_790_000_000, [])];
  assert.equal(bootModelPlan(blind, undefined).outcome, 'none-capable');
  assert.deepEqual(bootModelPlan(blind, 'qwen2.5-coder:14b').refused, {
    savedName: 'qwen2.5-coder:14b',
    reason: 'toolless',
  });
});

test('a single installed model is offered, never auto-selected', () => {
  const plan = bootModelPlan([QWEN_14B], undefined);
  assert.equal(plan.outcome, 'choose', 'one candidate is still a choice the user makes');
});

test('the choose outcome never carries an empty selectable list', () => {
  // chooseBootModel relies on this: with nothing to offer, the plan must say none-capable instead.
  for (const installed of [THIS_BOX, [QWEN_14B], [CODESTRAL, QWEN3_CODER]]) {
    const plan = bootModelPlan(installed, undefined);
    if (plan.outcome === 'choose') assert.ok(plan.selectable.length > 0);
  }
});

test('an empty saved name is treated as a name, not as absent', () => {
  // Pinning the function's own contract, not a reachable path: narrowAppState DROPS an activeModel that
  // is empty or whitespace, so loadAppState can never hand '' down. Any other caller can, and the
  // distinction between "no saved choice" (ask, say nothing) and "a saved choice that failed" (say why)
  // must not turn on falsiness.
  const plan = bootModelPlan(THIS_BOX, '');
  assert.equal(plan.outcome, 'choose');
  assert.deepEqual(plan.refused, { savedName: '', reason: 'missing' });
});
