// The one spelling of the "this model cannot call tools" marker.
//
// It appears in exactly TWO surfaces and nowhere else (OPEN-QUESTIONS.md #12 as clarified by #78):
// `/models list` and the boot chooser. Nothing paints it in the pinned status rows — no toolless model
// can ever be active, so that marker would have had no way to paint. Both surfaces read this constant
// so the two can never drift into saying the same thing two ways.

/** Shown beside a model that reports no `tools` capability, in `/models list` and the boot chooser. */
export const NO_TOOLS_MARKER = '(no tools)';
