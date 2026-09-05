// The INSERT every write of a turn uses, in one place because two callers share it: the hot-path flush
// and the summary collapse (which appends ` RETURNING id` to it).
//
// `created_at` is in the column list on purpose — it is passed EXPLICITLY rather than left to the
// column DEFAULT. See flush-context.ts for why.

/** The insert every flush uses. `created_at` is passed EXPLICITLY — see flush-context.ts. */
export const INSERT_MESSAGE =
  'INSERT INTO messages (context_id, seq, role, content, model, tool_name, tool_calls, ' +
  'prompt_tokens, completion_tokens, cancelled_at, created_at, updated_at) ' +
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
