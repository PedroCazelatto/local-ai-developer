// Title one phase context in a THROWAWAY window: the model is shown the conversation's opening and
// asked for a single line. One attempt per context per session -- a title is a convenience, and
// re-spending a window on it every turn is not what the num_ctx budget is for.

import type { Message } from 'ollama';

import type { ContextTitle } from './context-title.type.js';
import type { MemoryRecord } from './memory-record.type.js';
import type { OllamaClient } from '../llm/client.js';
import type { TokenCounts } from '../llm/token-counts.type.js';
import { buildTitleTranscript } from './build-title-transcript.js';
import { capTitle } from './cap-title.js';
import { loadPrompt } from '../../context/load-prompt.js';
import { oneShot } from '../llm/one-shot.js';
import { unwrapTitle } from './unwrap-title.js';

/** The rules the throwaway context is given — rules/prompts/context-title.md. */
const PROMPT_NAME = 'context-title';

/**
 * Ask a throwaway context for this context's title, then normalize what comes back: unwrapTitle the model's
 * packaging, keep one line, drop a trailing period, and capTitle the length. Returns null when the model
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
    { role: 'user', content: buildTitleTranscript(records) },
  ];
  // oneShot: one fresh call, no history and no tools; its turns never enter any phase's memory, so the
  // working phase pays nothing but wall-clock. Returns THIS call's exact tokens. 'context-title' is a
  // bounded role — the smaller ceiling is safe because buildTitleTranscript capped the input above.
  const { content, tokens } = await oneShot(llm, messages, 'context-title');
  const title = capTitle(unwrapTitle(content));
  return title === '' ? null : { title, tokens };
}
