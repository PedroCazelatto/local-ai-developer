// A sub-agent's cumulative token cost, as the /subagents listing prints it. Split out of
// subagents.ts.

import type { SubagentInfo } from '../../core/session/subagent-info.type.js';

/**
 * The EXACT cumulative token total (prompt + eval). A null on either metric (Ollama omitted it on some
 * turn) is surfaced as `unreported` rather than papered over with a 0 or a guess (constitution: token
 * counts are always exact; surface a missing one explicitly).
 */
export function tokenLabel(info: SubagentInfo): string {
  const { promptTokens, evalTokens } = info;
  if (promptTokens === null || evalTokens === null) {
    return 'tokens: unreported';
  }
  const fmt = (n: number): string => n.toLocaleString('en-US');
  return `${fmt(promptTokens + evalTokens)} tokens (${fmt(promptTokens)} prompt + ${fmt(evalTokens)} eval)`;
}
