// Read a model's `capabilities` off a raw `/api/tags` row, and FAIL CLOSED when it is not there.
//
// Why this needs narrowing at all, rather than a typed field: the pinned `ollama` package is 0.5.18,
// whose `ModelResponse` declares `name · modified_at · model · size · digest · details · expires_at ·
// size_vram` and NO `capabilities` (the field is on `ShowResponse` only). A package bump was weighed
// and rejected — see the header of list-models.ts — because the field's presence is a property of the
// DAEMON, not of the client library: Ollama only added `capabilities` to `/api/tags` in 0.9.1, so a
// declared `capabilities: string[]` would claim a field that an older daemon genuinely does not send.
// A read that checks is the honest shape, not a workaround for a stale type.
//
// FAILING CLOSED is the product rule (OPEN-QUESTIONS.md #13): an absent field means "assume incapable".
// Booting a walk-away batch onto a model that cannot call a tool costs the whole batch; a wrongly
// model-less boot costs one `/models use`. Boot also refuses outright on a daemon below 0.9.1
// (src/boot/ollama-version-refusal.ts), so this branch is the backstop rather than the diagnosis.

import { isRecord } from './is-record.js';

/**
 * The capability strings a raw `/api/tags` row reports (`completion`, `tools`, `insert`, `thinking`,
 * `vision`), or an EMPTY array when the row has no usable `capabilities` field — absent, null, not an
 * array. Non-string members are dropped rather than coerced: a capability we cannot read is one we
 * cannot honour. `row` is `unknown` because the daemon sends more than the pinned package declares.
 */
export function readCapabilities(row: unknown): readonly string[] {
  const raw: unknown = isRecord(row) ? row.capabilities : undefined;
  if (!Array.isArray(raw)) return [];
  // Array.isArray narrows `unknown` to `any[]`, which would make the filter callback's parameter `any`
  // — banned by the constitution. Re-binding through `readonly unknown[]` (a safe widening, not a cast)
  // keeps the element type honest so the predicate below is what does the narrowing.
  const items: readonly unknown[] = raw;
  return items.filter((item): item is string => typeof item === 'string');
}
