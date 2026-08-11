// load_rule (V4/02) — return the full markdown body of ONE coding-standard by its exact catalog
// `name` (the slug search_rules returns), with the YAML frontmatter stripped. This is the second half
// of CLAUDE.md's LLM-delegated retrieval: search_rules resolves intent → name(s) inside a throwaway
// context, then load_rule pulls only the CHOSEN body into the main context. An unknown name is a
// RECOVERABLE structured error listing the available names — the turn never dies (V1/02).

import { loadStandardBody } from '../context/index.js';
import type { StandardBody } from '../context/index.js';
import type { JsonObject, ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const loadRuleTool: ToolModule = {
  name: 'load_rule',
  description:
    'Load the full markdown of ONE coding-standards document by its exact catalog name (the slug ' +
    'search_rules returns), with frontmatter stripped. Call search_rules FIRST to get valid names; ' +
    'passing an unknown name returns the list of available names instead of the body.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Exact standard name (kebab-case slug) from search_rules, e.g. "clean-architecture".',
      },
    },
    required: ['name'],
  },

  async execute(_ctx, args): Promise<ToolResult> {
    const name = args['name'];
    if (typeof name !== 'string' || name.trim() === '') {
      return toolError("'name' must be a non-empty string.", 'Call search_rules first to get a valid standard name.');
    }
    let result: StandardBody;
    try {
      // loadStandardBody validates against the catalog (fail loud on a malformed catalog) and returns
      // the frontmatter-stripped body, or found:false carrying the available names.
      result = loadStandardBody(name);
    } catch (err) {
      return toolError(`standards catalog is unavailable: ${messageOf(err)}`);
    }
    if (!result.found) {
      const content: JsonObject = { error: 'unknown standard', name: name.trim(), available: [...result.available] };
      return { content, exitStatus: -1, error: 'unknown standard' };
    }
    const lines = result.body === '' ? 0 : result.body.split('\n').length;
    return { content: result.body, display: { summary: `${lines} line${lines === 1 ? '' : 's'}` } };
  },
};
