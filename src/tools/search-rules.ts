// search_rules (V4/02) — resolve a free-text intent to matching coding-standard names WITHOUT ever
// putting the catalog into the main context. It loads the {name, description} catalog (V4/01) and hands
// it, with the intent, to a FRESH throwaway model call (ctx.oneShot — same model, its own smaller
// num_ctx, never added to any phase's memory). The reply is UNTRUSTED: we parse it as a JSON array of
// strings and keep only names that actually exist in the catalog (a hallucinated name is dropped, never
// passed on). The model then calls load_rule with a returned name to pull that one body in. An empty
// result is valid.

import type { Message } from 'ollama';

import { loadCatalog } from '../context/load-catalog.js';
import type { StandardEntry } from '../context/load-catalog.js';
import { errMessage } from '../core/err-message.js'; // an Error's message, or the thrown value stringified
import { loadsOrRepair } from '../core/llm/loads-or-repair.js';
import { buildSearchUserPrompt } from './build-search-user-prompt.js'; // the catalog rides in the USER turn
import type { JsonObject } from './json-object.type.js';
import type { StructuredToolResult } from './structured-tool-result.type.js';
import { toolError } from './tool-error.js';
import type { ToolModule } from './tool-module.type.js';
import type { ToolResult } from './tool-result.type.js';
import { validateStandardNames } from './validate-standard-names.js'; // drops any name not in the catalog

// Kept SHORT on purpose — the catalog grows and rides in the user turn, not here (task V4/02).
const SEARCH_SYSTEM_PROMPT =
  "You match a developer's intent to a small catalog of coding-standards documents. Return ONLY a JSON " +
  'array of the matching standard names, drawn verbatim from the catalog. If nothing matches, return []. ' +
  'Do not invent names, do not add prose.';

export const searchRulesTool: ToolModule = {
  name: 'search_rules',
  description:
    'Find coding-standards documents relevant to what you are doing. Describe your intent in your own ' +
    'words (e.g. "layering between domain and infrastructure", "how to write the failing test first"); ' +
    'returns a JSON array of matching standard names to pass to load_rule. Returns an empty array if ' +
    'nothing matches. The catalog itself never enters your context — only the names you get back.',
  parameters: {
    type: 'object',
    properties: {
      intent: { type: 'string', description: 'What you need guidance on, in your own words.' },
    },
    required: ['intent'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const intent = args['intent'];
    if (typeof intent !== 'string' || intent.trim() === '') {
      return toolError("'intent' must be a non-empty string.", 'Describe what you need guidance on, e.g. "error handling in tools".');
    }

    let catalog: StandardEntry[];
    try {
      catalog = loadCatalog();
    } catch (err) {
      // A malformed catalog is a real fault but recoverable at the turn level — surface it, don't crash.
      return toolError(`standards catalog is unavailable: ${errMessage(err)}`);
    }
    if (catalog.length === 0) {
      return { content: { matches: [] }, display: { summary: 'the standards catalog is empty' } };
    }

    // The catalog + intent live ONLY inside this throwaway call and are discarded — never added to the
    // active phase's history (CLAUDE.md, LLM-delegated search). ctx.oneShot returns this call's exact tokens.
    const messages: Message[] = [
      { role: 'system', content: SEARCH_SYSTEM_PROMPT },
      { role: 'user', content: buildSearchUserPrompt(catalog, intent.trim()) },
    ];
    // 'search-rules' is a BOUNDED role and runs under a smaller ceiling than the calling window: the
    // catalog is name+description lines only (530 tokens across today's nine standards, 611 with the
    // intent), and load_rule — not this call — is what ever reads a body.
    const { content, tokens } = await ctx.oneShot(messages, 'search-rules');

    const names = new Set(catalog.map((entry) => entry.name));
    const matches = validateStandardNames(content, names);

    const result: StructuredToolResult = {
      content: { matches },
      // Record the throwaway call's EXACT cost on the audit row (never estimated — constitution).
      metadata: { searchModelPromptTokens: tokens.promptTokens, searchModelEvalTokens: tokens.evalTokens },
      // The names themselves, not just how many: they are short, and they are what the next load_rule
      // call will be about, so the two lines read as a pair.
      display: {
        summary: matches.length === 0 ? 'no match' : `${matches.length} standard(s): ${matches.join(', ')}`,
      },
    };
    return result;
  },
};

