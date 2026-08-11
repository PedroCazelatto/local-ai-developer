// Make MODEL-CONTROLLED text safe to print as one row of history.
//
// The tool-call record prints strings the model chose (a shell command, a search pattern, a claim) and
// strings the model WROTE (the lines of a diff it just produced). Both are untrusted for this purpose:
// the constitution's rule that "the model writes plain markdown and the orchestrator owns every color"
// only holds if a hallucinated — or deliberately planted — escape sequence cannot reach the terminal.
// An ESC in a file's content would otherwise repaint the theme, move the cursor off the row it was
// given, or scribble on the pinned status rows, none of which the append-only invariant survives.
//
// Written as an explicit code-point test rather than a regex character class: the classes involved are
// control characters, and a source file carrying them literally is the kind of thing an editor, a
// tool, or a copy/paste silently eats.

const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const SPACE = 0x20;
const DELETE = 0x7f;
/** The 8-bit CSI introducer: opens an escape sequence with no ESC byte in front of it. */
const CSI_8BIT = 0x9b;

/**
 * `text` with line breaks folded to spaces and every other control character removed.
 *
 * A newline becomes a space rather than being dropped, so two words never fuse into one. A tab is
 * kept: it is real content in an indented diff line, and the terminal renders it fine.
 */
export function stripControlChars(text: string): string {
  let safe = '';
  for (const glyph of text) {
    const code = glyph.codePointAt(0) ?? 0;
    if (code === LINE_FEED || code === CARRIAGE_RETURN) {
      safe += ' ';
    } else if (code === TAB) {
      safe += glyph;
    } else if (code >= SPACE && code !== DELETE && code !== CSI_8BIT) {
      safe += glyph;
    }
  }
  return safe;
}
