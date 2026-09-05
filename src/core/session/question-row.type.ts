// One append-only row in questions.jsonl, discriminated by `kind`. State is the replay of these rows:
// `asked` with no `answered` is pending; `answered` with no `delivered` is waiting to reach its phase's
// context. `delivered` is what stops an answer being injected into the same window twice.

import type { PendingQuestion } from './pending-question.type.js';

/**
 * One append-only row in questions.jsonl, discriminated by `kind`. State = replay of these rows:
 * `asked` with no `answered` is pending; `answered` with no `delivered` is waiting to reach its
 * phase's context. `delivered` is what stops an answer being injected into the same window twice.
 */
export type QuestionRow =
  | ({ readonly kind: 'asked' } & PendingQuestion)
  | { readonly kind: 'answered'; readonly id: string; readonly answer: string; readonly answeredAt: string }
  | { readonly kind: 'delivered'; readonly id: string; readonly deliveredAt: string };
