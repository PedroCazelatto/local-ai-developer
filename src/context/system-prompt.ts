// Minimal system-prompt builder (ports context/builder.py's ContextBuilder). Assembles the
// system message from the active phase's instructions + shared tool-use mechanics + a one-line
// project state. The phase markdown says WHICH tools to reach for; this block says HOW to call
// them at all, kept in code so the six phase files don't each repeat it.

const TOOL_USE_GUIDANCE = `# Tool Use
- When you decide to read, list, search, write, edit, or run something, emit the tool call in that same turn. Never describe or promise an action without performing it.
- Call tools only through the tool-calling mechanism. Do not print tool-call JSON as text in your reply, with or without markdown fences.
- After a tool result arrives, continue the task using that result.`;

/** Build the system prompt for a turn: phase instructions + tool-use rules + project context. */
export function buildSystemPrompt(instructions: string, projectState: string): string {
  return `${instructions}\n\n${TOOL_USE_GUIDANCE}\n\n# Project Context\n${projectState}\n`;
}
