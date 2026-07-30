// buildToolSection — render the tool set a window ACTUALLY sends to Ollama as a closed, named list
// inside its system prompt. This replaces the hand-written "## Tools available to you" paragraph the
// planning phase files used to carry, which drifted three separate times: `search_rules` shipped the
// day after Discovery was told it "does not exist yet", the sub-agent tools were registered "so the
// interactive phases advertise them" and then named in no phase file at all, and the four git tools
// were added to the same sentence while the stale claim sitting beside them survived the edit.
//
// The caller passes the SAME Tool[] it hands Ollama on that call, so the list cannot describe a
// different surface than the one the model can reach. Drift stops being a discipline problem and
// becomes structurally impossible: there is one source, and it is the array that gates the phase.
//
// NAMES ONLY, deliberately: every tool's full description already rides in the `tools` array on the
// very same request, so repeating the descriptions here would pay for the same text twice on a
// VRAM-bound box. This block answers "what do I have"; the `tools` array answers "how do I call it";
// the phase markdown answers "when should I reach for it".

import type { Tool } from '../core/llm/index.js';

const HEADING = '# Your Tools';

// Scoped to EXISTENCE, never to policy: the stale-claim bug this block exists to kill was a phase
// file asserting a live tool was unavailable. A phase file may still legitimately say "do not use X
// for Y", so the last sentence hands the "when" decision back to the phase instructions rather than
// licensing the model to ignore them.
//
// Kept to three short sentences on purpose. This block rides in the system prompt of EVERY turn of
// every phase, so each word is paid for on every call of a VRAM-bound box; the list below carries
// the actual information, and the lead only has to frame it as closed and live.
const LEAD =
  'These are the only tools that exist, and all of them work right now. Any other name returns an ' +
  'error. Your phase instructions decide when to use each one.';

/**
 * The system-prompt block naming every tool this window may call, in the order its phase array lists
 * them (phase-tool-names.ts owns that order, so related tools stay adjacent in the prompt).
 *
 * A nameless entry is skipped: `Tool.function.name` is optional in the Ollama type, and a tool the
 * model cannot name is a tool it cannot call — advertising it would promise something unreachable.
 */
export function buildToolSection(tools: readonly Tool[]): string {
  const names = tools
    .map((tool) => tool.function.name)
    .filter((name): name is string => name !== undefined && name.trim() !== '');

  // No tools at all is not a crash — but it must be stated, never rendered as an empty heading with
  // a silent gap under it, which reads as "the list failed to load" to a model and to a human.
  if (names.length === 0) {
    return `${HEADING}\nThis window has no tools. Answer from what you already know.`;
  }

  const lines = names.map((name) => `- \`${name}\``).join('\n');
  return `${HEADING}\n${LEAD}\n\n${lines}`;
}
