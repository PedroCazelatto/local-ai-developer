// `/models list` (V5/02) — a thin, session-agnostic query against the HOST Ollama daemon. It is also
// the ONE round trip the boot capability gate needs: `/api/tags` returns every model's `capabilities`
// and `digest` alongside its size, so nothing here fans out to `/api/show` and nothing is cached.
//
// THE PINNED `ollama` PACKAGE CANNOT SEE `capabilities`, and the choice made about that is recorded
// here because it is the kind of thing a later reader will want to reverse. 0.5.18's `ModelResponse`
// declares `name · modified_at · model · size · digest · details · expires_at · size_vram` and no
// `capabilities` (the field is on `ShowResponse` only). The options were a package bump or a narrowed
// read of the raw row; this is the narrowed read (read-capabilities.ts), because the field's presence
// is a property of the DAEMON rather than of the client library — Ollama only added it to `/api/tags`
// in 0.9.1, so a declared `capabilities: string[]` would assert a field an older daemon does not send,
// and the fail-closed rule exists precisely for that case. A bump would also not have removed the
// check, only hidden the need for it.

import { daemon } from './daemon.js';
import { readCapabilities } from './read-capabilities.js';

/** One locally-installed model, projected from Ollama's `/api/tags` row to just what this repo uses. */
export interface InstalledModel {
  /** Full tagged name, e.g. `qwen2.5-coder:3b` — what `/models use` must match exactly. */
  readonly name: string;
  /** On-disk size in bytes (formatted human-readable for the table). */
  readonly size: number;
  /** When the blob was last written locally. */
  readonly modifiedAt: Date;
  /**
   * The blob's content digest. Carried because a TAG is not an identity — `:latest` can be re-pulled
   * as different bytes — so anything that remembers a per-model measurement has to key on this rather
   * than on the name.
   */
  readonly digest: string;
  /**
   * What the daemon says this model can do (`completion`, `tools`, `insert`, `thinking`, `vision`).
   * EMPTY when the daemon reported no such field, which the gate reads as incapable — see
   * read-capabilities.ts for why that is the safe direction and supports-tools.ts for the gate itself.
   */
  readonly capabilities: readonly string[];
}

/** List locally-installed models, projected to the fields above and sorted by name. */
export async function listModels(): Promise<InstalledModel[]> {
  const { models } = await daemon.list();
  return models
    .map((m) => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
      digest: m.digest,
      // readCapabilities narrows the RAW row (the pinned package's type omits the field) and yields []
      // when the daemon does not report one — the fail-closed case.
      capabilities: readCapabilities(m),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
