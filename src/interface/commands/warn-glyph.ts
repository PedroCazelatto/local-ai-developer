// The warning glyph, in one place because /resume writes it TWICE for the same fact — as the marker on
// a listing row and as the prefix of the line printed after the restore — and a marker that disagreed
// with its own legend would be worse than no marker.
//
// A vocabulary constant rather than a property of either function: render-context-list.ts and
// warn-smaller-ceiling.ts both write it and neither owns it.
//
// OPEN, and deliberately not decided here: four other files still write the same literal inline —
// core/session/process-message.ts, interface/render-batch-summary.ts, interface/render-retro-result.ts
// and interface/commands/run.ts. Whether they should all read one constant, and whether that constant
// belongs under core/ui/ beside panel-indent.ts (where the "the concern decides the home" rule would
// send display vocabulary) rather than here, spans directories this wave does not own. It is reported
// rather than settled, and moving this file is a one-line change to each importer.

/** The warning glyph the rest of the UI writes inline (render-batch-summary.ts, render-retro-result.ts). */
export const WARN_GLYPH = '⚠';
