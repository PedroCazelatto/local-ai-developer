// Wrap a round's Reviewer feedback into the user turn that drives the next Worker fix (V3/01). The
// Worker window is NEVER reset between rounds, so this message is appended onto its full prior
// history: it already holds the code it wrote and the tests it ran. The orders here therefore say
// "build on what you have, address every issue, re-run the tests" — not "start over".

/** Build the next Worker turn from a fail verdict's feedback block (see format-review-feedback). */
export function buildWorkerFixMessage(feedback: string): string {
  return `The Reviewer did NOT pass your work. Do NOT start over — build on what you already wrote. Address EVERY issue below, then re-run the tests with run_in_project to confirm they pass.

## Reviewer feedback
${feedback.trim()}

When finished, end with an updated plain-text SUMMARY (files touched, what you changed to resolve the feedback, anything still uncertain). Do not call a tool in that final turn.`;
}
