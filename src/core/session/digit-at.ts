// One Crockford base32 digit. The alphabet omits I, L, O and U so an id read aloud or typed from a
// screen cannot be misheard -- which is the whole reason a sub-agent id is base32 and not hex.

/** Crockford base32 alphabet (omits I, L, O, U so the short id is unambiguous when read aloud). */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Map an already-in-range (0..31) index to its Crockford digit; `?? '0'` satisfies noUncheckedIndexedAccess. */
export function digitAt(index: number): string {
  return CROCKFORD[index] ?? '0';
}
