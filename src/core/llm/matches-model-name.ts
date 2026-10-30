// Whether an installed model's full tag identifies the model a user named. One predicate, and every
// place that has to turn a typed name into an installed model goes through it — `/models list`'s active
// marker, `/models use`'s presence-and-capability lookup, the boot resolution (bootModelPlan), and
// hasModel — so the tag-matching rule can never drift apart between them.

/**
 * True when `installedName` (always a full `name:tag` from the daemon) is the model `wanted` names.
 * Matches the full tag exactly; if `wanted` omits the tag, also accepts the `:latest` form — Ollama's
 * implicit default, matching how `ollama run <name>` resolves it.
 */
export function matchesModelName(installedName: string, wanted: string): boolean {
  const tagged = wanted.includes(':') ? wanted : `${wanted}:latest`;
  return installedName === wanted || installedName === tagged;
}
