// A container name no other run_in_project call can collide with.
//
// The project name is sanitised because it reaches Docker's `--name`, which accepts only
// `[a-zA-Z0-9_.-]`; every other character becomes `_`. That sanitisation is why the name cannot be
// the project name alone -- two projects differing only in a punctuation character would sanitise to
// the same string -- and why the timestamp and the random suffix are both here rather than either
// one: docker-compose runs are `--rm` and short, so two calls can land in the same millisecond.
//
// It is deliberately NOT derived from anything the model supplies.

/** A collision-free `--rm` container name for one run_in_project call. */
export function uniqueContainerName(project: string): string {
  const safe = project.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `lad_${safe}_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
