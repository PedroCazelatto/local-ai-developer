// Compare a reported daemon version against a floor, NUMERICALLY.
//
// A string compare gets this wrong in the one direction that matters: `'0.10.0' < '0.9.1'` is true as
// text and false as a version, and 0.10 is exactly the release range a 0.9.1 floor has to admit. So
// the segments are compared as numbers, left to right.

/**
 * `ok` — `found` is at or above `floor`; `below` — it is older; `unreadable` — there is no version to
 * compare (absent, or no leading number). `unreadable` is deliberately NOT a pass: the caller refuses
 * on it, because a check that cannot run must not report a pass.
 */
export type FloorVerdict = 'ok' | 'below' | 'unreadable';

/**
 * Whether `found` meets `floor` (both `major.minor.patch`; a missing segment reads as 0). A leading
 * `v` is tolerated, and anything after the numeric triple is IGNORED — `0.9.1-rc1` counts as meeting a
 * `0.9.1` floor, because a release candidate of a tag carries that tag's endpoint changes and refusing
 * it would reject a daemon that can in fact answer the question the floor exists to ask.
 */
export function meetsVersionFloor(found: string | undefined, floor: string): FloorVerdict {
  // Local, so it is this function's implementation rather than a second declaration (constitution).
  const segments = (text: string): readonly number[] | undefined => {
    const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(text.trim());
    if (match === null) return undefined;
    return [Number(match[1] ?? '0'), Number(match[2] ?? '0'), Number(match[3] ?? '0')];
  };

  const left = segments(found ?? '');
  const right = segments(floor);
  if (left === undefined || right === undefined) return 'unreadable';
  for (let i = 0; i < 3; i += 1) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    if (a !== b) return a > b ? 'ok' : 'below';
  }
  return 'ok';
}
