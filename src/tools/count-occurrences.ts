// Count non-overlapping occurrences of a needle in a haystack — the exactly-once precondition both
// exact-string edit tools rest on.
//
// It answers the question edit_file and edit_phase_rule both have to ask before they splice: is this
// `old_string` unique? Zero means the model is editing against a file it has misremembered; more than
// one means the splice would land somewhere it did not choose. Neither is a failure to recover from
// silently, so the COUNT is returned rather than a boolean — the error tells the model how many
// matches it has to disambiguate.
//
// Non-overlapping matters: searching for `aa` in `aaa` is one occurrence, not two, because that is
// what a single splice can act on. `''` is zero rather than infinity.
//
// It was declared privately in both edit-file.ts and edit-phase-rule.ts with identical bodies -- the
// second header even said "matches edit_file's semantics", which is a duplicate announcing itself.

/** Count non-overlapping occurrences of `needle` in `haystack` (matches Python str.count semantics). */
export function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}
