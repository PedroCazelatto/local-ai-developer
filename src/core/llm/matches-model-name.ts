// Whether an installed model's full tag identifies the model a user named. One predicate, three callers
// (hasModel, `/models list`'s active marker, the boot resolution) — the tag-matching rule lives here so
// they can never drift apart.

/**
 * True when `installedName` (always a full `name:tag` from the daemon) is the model `wanted` names.
 * Matches the full tag exactly; if `wanted` omits the tag, also accepts the `:latest` form — Ollama's
 * implicit default, matching how `ollama run <name>` resolves it.
 */
export function matchesModelName(installedName: string, wanted: string): boolean {
  const tagged = wanted.includes(':') ? wanted : `${wanted}:latest`;
  return installedName === wanted || installedName === tagged;
}
