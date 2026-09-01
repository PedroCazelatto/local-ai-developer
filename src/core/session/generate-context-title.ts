// generateContextTitle — write the one-line title that describes WHY a phase context exists.
//
// The title is what makes a context a usable record: `/resume` lists it, and the `switch_phase` tool
// will choose between opening a fresh context and reopening an old one with nothing else to go on. So it
// must describe the reason the conversation exists, not merely its first message.
//
// Written by a CLEAN model context — the same throwaway one-shot device composeCommitMessage and
// search_rules use (oneShot: same model, no tools, never appended to any phase's history), so the
// working phase pays no context for it. Its input is the context's own message history plus the rules
// in rules/prompts/context-title.md. Called once per context, after its first prose answer.
//
// It is a BOUNDED one-shot (resolve-window-ctx.ts) and runs under a smaller `num_ctx` than the window
// that triggered it, which is only true because buildTranscript below caps what it is handed.

import { loadPrompt } from '../../context/load-prompt.js';
import type { Message, OllamaClient, TokenCounts } from '../llm/index.js';
import { oneShot } from '../llm/index.js';
import type { MemoryRecord } from './memory-record.type.js';
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

/**
 * Hard cap, in characters, on the transcript handed to the title writer.
 *
 * The normal path needs nothing like this — a title is written straight after a context's FIRST prose
 * answer, so the transcript is one exchange. The reopen path is why it exists: `titleAttempted` resets
 * when a context is reopened (memory.ts), so an untitled context brought back by `/resume` is titled
 * from its ENTIRE replayed history, which can be most of a full window. That is what would otherwise
 * overflow this role's smaller ceiling and have Ollama silently drop the front of it.
 *
 * 6 000 characters is roughly 1 540 tokens at the ~3.9 chars/token this repo's prose measures at,
 * which with the ~350-token prompt file leaves the call an order of magnitude inside its 8 192 ceiling
 * — room for rules/prompts/context-title.md to grow without this needing to be revisited.
 */
const TRANSCRIPT_BUDGET = 6000;

/** Told to the model whenever the budget bit, so it knows it is reading a prefix rather than the whole. */
const TRUNCATION_NOTICE = '\n\n(transcript truncated — this is the opening of the conversation)';

/**
 * Render the context's turns for the title writer (same shape the summarizer's transcript uses),
 * bounded to TRANSCRIPT_BUDGET characters from the HEAD.
 *
 * The head, specifically — not `truncateHeadTail`, which is this repo's default instrument everywhere
 * else. A title says WHY a context exists, and that is established by how the conversation opened; its
 * tail is where the work got to, which is a different question. Cutting whole turns rather than
 * characters keeps every turn the model does see intact, so it never reasons from half a message.
 */
function buildTranscript(records: readonly MemoryRecord[]): string {
  const rendered = records.map(renderTurn);
  const kept: string[] = [];
  let used = 0;
  for (const turn of rendered) {
    const cost = kept.length === 0 ? turn.length : turn.length + 2; // + the '\n\n' this turn joins on
    if (used + cost > TRANSCRIPT_BUDGET) break;
    kept.push(turn);
    used += cost;
  }
  // An opening turn larger than the whole budget still has to yield something to title: take its head
  // rather than hand over an empty transcript and get an invented title back.
  const body = kept.length > 0 ? kept.join('\n\n') : (rendered[0] ?? '').slice(0, TRANSCRIPT_BUDGET);
  const notice = kept.length < rendered.length ? TRUNCATION_NOTICE : '';
  return `Write the title for this conversation:\n\n${body}${notice}`;
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
  // working phase pays nothing but wall-clock. Returns THIS call's exact tokens. 'context-title' is a
  // bounded role — the smaller ceiling is safe because buildTranscript capped the input above.
  const { content, tokens } = await oneShot(llm, messages, 'context-title');
  const title = cap(unwrap(content));
  return title === '' ? null : { title, tokens };
}
