// Type for insert-newline.ts (constitution: types live in a sibling file, never inline).

/**
 * The writable view of readline's live edit buffer. `line` and `cursor` are documented public fields
 * of `readline.Interface`, but `@types/node` declares both `readonly` — true for every consumer except
 * the one that owns the buffer's content, which is exactly what inserting a line break makes us.
 *
 * Widening happens by assigning the Interface to this type (TypeScript ignores `readonly` when it
 * checks assignability), so no `as` is involved. Declaring the two fields and nothing else is what
 * keeps that honest: the widened handle cannot reach any other part of the Interface.
 */
export interface EditableLine {
  line: string;
  cursor: number;
}
