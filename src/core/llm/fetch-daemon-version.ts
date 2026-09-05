// Ask the HOST Ollama daemon which version it is — the boot floor check's one input.
//
// `/api/version` is a single unauthenticated GET, and the `ollama` package wraps no such endpoint, so
// this is a raw fetch against the same address daemon.ts's client uses (ollama-host.ts). It is kept
// separate from the verdict (ollama-version-refusal.ts) precisely so the verdict stays a PURE function
// of a version string and can be driven with a version this machine does not run.

import { isRecord } from './is-record.js';
import { OLLAMA_HOST } from './ollama-host.js';

/**
 * The daemon's reported version (e.g. `0.9.1`), or undefined when it did not report one — a non-2xx
 * reply, a body that is not an object, or a `version` that is not a non-empty string. Undefined means
 * "the daemon cannot say", which the caller treats as a REFUSAL rather than a pass: a check that cannot
 * run must not report a pass (the same rule scripts/run.mjs applies to an unreadable .nvmrc).
 *
 * THROWS when the daemon is unreachable, exactly as listModels does — boot reports that as the fatal
 * "could not reach Ollama" it already has, not as a version problem.
 */
export async function fetchDaemonVersion(): Promise<string | undefined> {
  const response = await fetch(`${OLLAMA_HOST}/api/version`);
  if (!response.ok) return undefined;
  const body: unknown = await response.json();
  if (!isRecord(body)) return undefined;
  const version = body.version;
  if (typeof version !== 'string') return undefined;
  const trimmed = version.trim();
  return trimmed === '' ? undefined : trimmed;
}
