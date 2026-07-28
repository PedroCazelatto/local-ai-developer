// Wrap a round's Reviewer feedback into the user turn that drives the next Worker fix (V3/01). The
// Worker window is NEVER reset between rounds, so this message is appended onto its full prior
// history: it already holds the code it wrote and the tests it ran. The orders here therefore say
// "build on what you have, address every issue, re-run the tests" — not "start over".
//
// The Reviewer commits PARTIALLY, so this turn also has to tell the Worker which of its files were
// accepted: those are committed and out of the working tree, and re-doing them is wasted rounds. What
// is left in the tree is exactly what came back — and every one of those files carries an issue
// (enforced in verdict-git-conflict), so the feedback block below always explains what to do with it.

/** Build the next Worker turn from a fail verdict's feedback block (see format-review-feedback). */
export function buildWorkerFixMessage(feedback: string, committed: readonly string[] = []): string {
  const accepted =
    committed.length === 0
      ? ''
      : `\n## Already accepted and committed\n${committed.map((file) => `- ${file}`).join('\n')}\n` +
        `These are done — do not redo them. Anything still in the working tree came back to you.\n`;

  return `The Reviewer did NOT pass your work. Do NOT start over — build on what you already wrote. Address EVERY issue below, then re-run the tests with run_in_project to confirm they pass.
${accepted}
## Reviewer feedback
${feedback.trim()}

When finished, end with an updated plain-text SUMMARY (files touched, what you changed to resolve the feedback, anything still uncertain). Do not call a tool in that final turn.`;
}
