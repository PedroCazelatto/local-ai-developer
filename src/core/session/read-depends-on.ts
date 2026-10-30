// Read a task's `depends_on` list. Accepts the two shapes a model actually writes — a bare string for
// a single dependency, or a YAML list — and rejects anything else loudly, because a dependency the
// reader silently dropped would make an ineligible task look runnable.

import { BacklogError } from './backlog-error.js';

/** Absent -> []; a string -> a one-element list; an array of strings -> itself; else a loud error. */
export function readDependsOn(raw: unknown, where: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (typeof raw === 'string') return raw.trim() === '' ? [] : [raw.trim()];
  if (Array.isArray(raw)) {
    return raw.map((d, i) => {
      if (typeof d !== 'string') {
        throw new BacklogError(`Task '${where}' depends_on[${i}] must be a string task id.`);
      }
      return d.trim();
    });
  }
  throw new BacklogError(`Task '${where}' depends_on must be a string or a list of strings.`);
}
