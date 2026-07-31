// generateContextTitle — write the one-line title that describes WHY a phase context exists.
//
// The title is what makes a context a usable record: `/resume` lists it, and the `switch_phase` tool
// will choose between opening a fresh context and reopening an old one with nothing else to go on. So it
// must describe the reason the conversation exists, not merely its first message.
//
// Written by a CLEAN model context — the same throwaway one-shot device composeCommitMessage and
// search_rules use (oneShot: same model + num_ctx, no tools, never appended to any phase's history), so
// the working phase pays no context for it. Its input is the context's own message history plus the
// rules in rules/prompts/context-title.md. Called once per context, after its first prose answer.

import { loadPrompt } from '../../context/load-prompt.js';
import { oneShot } from '../llm/index.js';
import type { Message, OllamaClient, TokenCounts } from '../llm/index.js';
import type { MemoryRecord } from './memory-db.type.js';
import { renderTurn } from './render-turn.js';

/** Hard ceiling on a stored title, so one always fits a listing row beside the id and token counts. */
export const CONTEXT_TITLE_LIMIT = 60;

/** The rules the throwaway context is given — rules/prompts/context-title.md. */
const PROMPT_NAME = 'context-title';

/** A title plus the EXACT tokens the throwaway call spent producing it (never estimated). */
export interface ContextTitle {
  readonly title: string;
  readonly tokens: TokenCounts;
}

/** Strip a fence, a wrapping quote pair, a bullet, a heading, or a `Title:` label a local model adds. */
function unwrap(raw: string): string {
  let text = raw.trim();
  const fenced = /^```[a-z]*\n([\s\S]*?)\n?```$/i.exec(text);
  if (fenced?.[1] !== undefined) text = fenced[1].trim();
  // First non-empty line only: a model that ignored "one line" must not store a paragraph.
  text = (text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '').trim();
  text = text.replace(/^([-*+]|#{1,6}|\d+[.)])\s+/, '').trim();
  text = text.replace(/^title\s*[:\-–]\s*/i, '').trim();
  const quoted = /^"([\s\S]*)"$/.exec(text) ?? /^'([\s\S]*)'$/.exec(text) ?? /^`([\s\S]*)`$/.exec(text);
  if (quoted?.[1] !== undefined) text = quoted[1].trim();
  return text.replace(/[.,;:]+$/, '').trim();
}

/** Cap at CONTEXT_TITLE_LIMIT on a word boundary where one is near the cut, so a title never ends mid-word. */
function cap(text: string): string {
  if (text.length <= CONTEXT_TITLE_LIMIT) return text;
  const cut = text.slice(0, CONTEXT_TITLE_LIMIT);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace >= CONTEXT_TITLE_LIMIT - 15 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/** Render the context's turns for the title writer (same shape the summarizer's transcript uses). */
function buildTranscript(records: readonly MemoryRecord[]): string {
  return `Write the title for this conversation:\n\n${records.map(renderTurn).join('\n\n')}`;
}

/**
 * Ask a throwaway context for this context's title, then normalize what comes back: unwrap the model's
 * packaging, keep one line, drop a trailing period, and cap the length. Returns null when the model
 * returned nothing usable — a context simply stays untitled rather than carrying an invented or empty
 * title, and the caller does not retry it this session.
 *
 * Never throws for a model-quality reason. A missing prompt file (PromptNotFoundError from loadPrompt)
 * and a transport failure DO propagate: those are faults the caller should see and report.
 */
export async function generateContextTitle(
  llm: OllamaClient,
  records: readonly MemoryRecord[],
): Promise<ContextTitle | null> {
  if (records.length === 0) return null;
  // loadPrompt: read rules/prompts/context-title.md fresh — an edit applies on the next call, no restart.
  const messages: Message[] = [
    { role: 'system', content: loadPrompt(PROMPT_NAME) },
    { role: 'user', content: buildTranscript(records) },
  ];
  // oneShot: one fresh call, no history and no tools; its turns never enter any phase's memory, so the
  // working phase pays nothing but wall-clock. Returns THIS call's exact tokens.
  const { content, tokens } = await oneShot(llm, messages);
  const title = cap(unwrap(content));
  return title === '' ? null : { title, tokens };
}
