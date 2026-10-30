// The boot-time Ollama version floor — the third member of the family scripts/run.mjs's Node check
// belongs to, and the one that cannot live there.
//
// Why it exists (OPEN-QUESTIONS.md #72, #79b). The capability gate FAILS CLOSED: a model whose
// `capabilities` we cannot read is treated as toolless. Ollama only added `capabilities` to
// `/api/tags` in 0.9.1 (PR #10174, released 2025-06-09; `/api/show` had it from 0.6.4, but reading it
// there would cost one round trip per model instead of one for all of them). So on an older daemon
// EVERY installed model fails the gate and the user is told "nothing here supports tools" when the
// truth is "your daemon cannot say". Stating the floor in a README does not fix that; refusing does.
//
// Why not scripts/run.mjs, where the Node check lives: the daemon's version is only knowable by asking
// the daemon. Boot already fails hard on an unreachable Ollama, so this sits beside that check and
// reads as the same shape — name the requirement, name what was found, say what to do.
//
// It is a PURE function of a version string on purpose. The fetch is fetch-daemon-version.ts, so the
// refusal can be driven with a version this machine does not run (it reports 0.33.2, far past the
// floor, so the happy path is the only one observable live).

import { meetsVersionFloor } from '../core/llm/meets-version-floor.js';

/** The oldest Ollama whose `/api/tags` reports per-model `capabilities`. Below it, the gate is blind. */
const MIN_OLLAMA_VERSION = '0.9.1';

/**
 * The refusal boot should die with, or undefined when the daemon is new enough. `found` is whatever
 * `/api/version` reported, and undefined means it reported nothing usable — which REFUSES too, for the
 * reason scripts/run.mjs refuses on an unreadable .nvmrc: a check that cannot run must not report a
 * pass. Returning the message rather than exiting keeps the only process.exit in src/ inside fail().
 */
export function ollamaVersionRefusal(found: string | undefined): string | undefined {
  // meetsVersionFloor compares the version segments as NUMBERS ('0.10.0' beats '0.9.1', which a string
  // compare gets backwards), and answers 'unreadable' when there is no version to compare at all.
  const verdict = meetsVersionFloor(found, MIN_OLLAMA_VERSION);
  if (verdict === 'ok') return undefined;
  if (verdict === 'below') {
    return [
      `Ollama ${MIN_OLLAMA_VERSION} or newer is required — found ${found ?? ''}.`,
      '',
      `  Only from ${MIN_OLLAMA_VERSION} does /api/tags report what each model can do, and this session`,
      '  refuses any model it cannot confirm supports tool calling — so on this daemon every installed',
      '  model would look incapable. Upgrade Ollama and try again.',
    ].join('\n');
  }
  return [
    `Cannot check the Ollama version — the daemon did not report one${found === undefined ? '' : ` (it said '${found}')`}.`,
    '',
    `  This session needs Ollama ${MIN_OLLAMA_VERSION} or newer, because only from that version does`,
    '  /api/tags report what each model can do. With nothing to check against there is nothing to',
    '  check, and a check that cannot run must not report a pass. Upgrade or restart Ollama and try',
    '  again.',
  ].join('\n');
}
