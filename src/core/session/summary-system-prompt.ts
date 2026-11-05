// The summarizer's instructions, shared by BOTH failsafes: the interactive one (compact-active-phase.ts)
// and the spawned-window one (compact-spawned-window.ts). One copy, because a Worker's history and a
// planning phase's are compressed for the same reason and must keep the same artifacts.

// Terse, artifact-preserving compression — the three requirements from the task, verbatim in intent.
export const SUMMARY_SYSTEM_PROMPT =
  'You are compressing an EARLIER slice of a coding-agent transcript so the conversation stays under a ' +
  'hard VRAM/context limit. Rewrite the slice into ONE terse summary that PRESERVES concrete artifacts — ' +
  'file paths, function/type/module names, decisions made and their rationale, open questions, TODOs, ' +
  'and any cross-phase inbox items raised — over conversational filler. Do not restate turns verbatim; ' +
  'target a small fraction of the original length. Output ONLY the summary prose, no preamble or headings.';
