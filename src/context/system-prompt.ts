// Minimal system-prompt builder (Foundation task 06; ports context/builder.py's ContextBuilder).
// Assembles the system message from the active phase's instructions + the tools that phase actually
// holds + shared tool-use mechanics + how output is displayed + a one-line project state. The phase
// markdown says WHICH tools to reach for; these blocks say WHAT exists, HOW to call them, what to
// do with their results, and how the reply will be rendered — kept in code so the six phase files
// don't each repeat it.
//
// The "Foundation task 06" tag above was carried by the context/ barrel, which the
// one-function-per-file sweep deleted; it is recorded here because nothing else in the directory
// held it.

import type { Tool } from '../core/llm/index.js';
import { buildToolSection } from './build-tool-section.js';

// The model writes PLAIN markdown and never names a color: the terminal renderer (theme.ts +
// render-markdown-line.ts) owns the construct→color mapping, so the palette is retuned in one place
// and a model that hallucinated a color could not fight it. This block only has to tell the model
// that its markdown is really rendered — otherwise it has no reason to believe the syntax is worth
// emitting, or might avoid it as noise.
const OUTPUT_FORMAT_GUIDANCE = `# Your Output
- Your replies are rendered as markdown in a color terminal, live as you type them. The syntax itself is never shown to the user: it is consumed and turned into real formatting, so use it freely — it costs the reader nothing.
- What each construct becomes on screen: \`#\`/\`##\`/\`###\` headings turn into colored headings, \`**bold**\` into bright bold text, \`\` \`code\` \`\` and \`\`\`fenced blocks\`\`\` into colored code, \`-\` and \`1.\` lists into aligned bullets, \`>\` into a quoted aside, and \`---\` into a full-width rule.
- Write NO raw ANSI escape codes and no color names. You do not choose colors — the terminal maps each markdown construct to its own color. A literal escape sequence would be printed as garbage.
- Structure your replies with markdown so they scan: a heading for a new section, a list for anything enumerable, bold for the one thing that matters most, a fenced block (with its language tag) for code and commands.
- Keep prose in plain sentences between those structures. Formatting is for making the content readable, not for decorating every line.`;

const TOOL_USE_GUIDANCE = `# Tool Use
- When you decide to read, list, search, write, edit, or run something, emit the tool call in that same turn. Never describe or promise an action without performing it.
- Call tools only through the tool-calling mechanism. Do not print tool-call JSON as text in your reply, with or without markdown fences.
- After a tool result arrives, continue the task using that result.
- The user never sees tool results — only you do. So when the user asked you to run a tool or to show them something (list files, read a file, search, run a command), you MUST relay what the tool returned in your very next reply. Write that reply as natural language for a person — plain sentences, and a simple markdown list when you are listing items — NEVER a JSON object, a key/value dump, or a fenced data block. Include everything that was asked for, and answer it before moving on to "what's next".
- When you ran a tool only to inform your own reasoning and the user did not ask to see the raw output, just use the result — you need not paste it back. For long command or test logs, report the outcome and the key lines rather than the entire log.
- NEVER paste a file's contents into your reply. After you write or edit a file, say what you changed and give the file **path** (e.g. \`src/foo/bar.ts\`) — the file on disk is the source of truth and can be read from that path later; a copy in the chat only bloats the context. When you read a file to inform your own work, use what you learned from it; do not echo the whole file back. Quote at most the few specific lines that matter to the point you are making.`;

/**
 * Build the system prompt for a turn: phase instructions + the tool inventory + tool-use + output
 * format + project context.
 *
 * `tools` MUST be the very array this window sends to Ollama on the same call. buildToolSection
 * renders it into the closed "# Your Tools" list, so the prompt can never advertise a surface the
 * model does not hold — the drift the phase files' hand-written inventories kept reintroducing.
 * The inventory sits BEFORE the mechanics block: what exists, then how to call it.
 */
export function buildSystemPrompt(
  instructions: string,
  tools: readonly Tool[],
  projectState: string,
): string {
  const toolSection = buildToolSection(tools);
  return `${instructions}\n\n${toolSection}\n\n${TOOL_USE_GUIDANCE}\n\n${OUTPUT_FORMAT_GUIDANCE}\n\n# Project Context\n${projectState}\n`;
}
