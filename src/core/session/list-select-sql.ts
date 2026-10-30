// The listing query both context readers share.
//
// Every listing figure is DERIVED here rather than stored, so no counter can drift from the turns it
// counts. Turn count and token total cover the VISIBLE turns only (the join is filtered), so the two
// agree with each other and with what a reopen would actually replay. `models` is comma-joined by
// group_concat — model names cannot contain a comma — and its order is unspecified.

import { visibleTurnWhere } from './visible-turn-where.js';

/** The SELECT + JOIN both listContexts and readContextSummary build on. */
export const LIST_SELECT = `
  SELECT c.id, c.phase, c.title, c.created_at, c.num_ctx,
         COUNT(m.seq) AS turns,
         COALESCE(SUM(m.prompt_tokens), 0) + COALESCE(SUM(m.completion_tokens), 0) AS tokens,
         COALESCE(MAX(m.created_at), c.created_at) AS last_at,
         group_concat(DISTINCT m.model) AS models
  FROM contexts c
  LEFT JOIN messages m ON m.context_id = c.id AND ${visibleTurnWhere('m.')}
`;
