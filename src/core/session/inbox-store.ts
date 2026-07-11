// Cross-phase inbox store (V3/04) — append-only JSONL under projects/<active>/.orchestrator/inbox/,
// ONE file per RECIPIENT phase (worker.jsonl, reviewer.jsonl, …), created on first write. Same
// discipline as the blocker store / tool audit log: one JSON line per EVENT (post or resolve),
// fsync'd per row so a kill mid-write leaves a partial LAST line at worst; open-vs-resolved state is
// derived by REPLAY, never mutated in place. This replaces the fragile single-file AGENT_NOTES.md
// (racy whole-file rewrites, drifting `- [OPEN]` formatting) with a structured, per-recipient channel.
//
// A cohesive store module (like blocker-store.ts / backlog.ts): a few tightly-related readers/writers
// over the inbox files, not one function per file. The three inbox tools (src/tools/inbox-*.ts) share it.

import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';

import type { InboxEvent, InboxItem, InboxReadStatus, InboxResolveResult, Phase } from './inbox-store.type.js';

/** The six phases in canonical PascalCase — the closed set every `to`/`from`/recipient is validated against. */
const PHASES: readonly Phase[] = ['Discovery', 'Design', 'Breakdown', 'Worker', 'Reviewer', 'Retro'];

/**
 * Canonicalize a phase name to its PascalCase form, or undefined if it is not one of the six. Matches
 * CASE-INSENSITIVELY on purpose: the local model may emit `worker`/`Worker`/`WORKER`, and `ctx.phase`
 * is always lowercase — all fold to the one canonical `Worker`. This is the single validation point
 * (the old markdown file had none, so a typo silently vanished from every future regex).
 */
export function canonicalizePhase(name: string): Phase | undefined {
  const lower = name.trim().toLowerCase();
  return PHASES.find((phase) => phase.toLowerCase() === lower);
}

/** Absolute path to a recipient phase's inbox file (lowercased name, e.g. `worker.jsonl`). */
function inboxFile(projectPath: string, phase: Phase): string {
  return path.join(projectPath, '.orchestrator', 'inbox', `${phase.toLowerCase()}.jsonl`);
}

/** Append one event to a recipient's file, creating .orchestrator/inbox/ on first write, fsync'd (as audit.ts). */
function appendEvent(projectPath: string, phase: Phase, event: InboxEvent): void {
  const dir = path.join(projectPath, '.orchestrator', 'inbox');
  mkdirSync(dir, { recursive: true });
  const line = `${JSON.stringify(event)}\n`;
  const fd = openSync(inboxFile(projectPath, phase), 'a');
  try {
    writeSync(fd, line);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Read + parse a recipient's events; a malformed line is skipped (a torn last line must not sink replay). */
function readEvents(projectPath: string, phase: Phase): InboxEvent[] {
  const file = inboxFile(projectPath, phase);
  if (!existsSync(file)) return [];
  const events: InboxEvent[] = [];
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isInboxEvent(parsed)) events.push(parsed);
    } catch {
      // A partial/torn line (a kill mid-write) — skip it, keep replaying the intact rows.
    }
  }
  return events;
}

/** Narrow a parsed JSON value to an InboxEvent (defensive — the file is hand-inspectable + machine-fed). */
function isInboxEvent(value: unknown): value is InboxEvent {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  if (row['kind'] === 'post') {
    return (
      typeof row['id'] === 'string' &&
      typeof row['from'] === 'string' &&
      typeof row['to'] === 'string' &&
      typeof row['created'] === 'string' &&
      typeof row['body'] === 'string'
    );
  }
  if (row['kind'] === 'resolve') {
    return (
      typeof row['id'] === 'string' &&
      typeof row['by'] === 'string' &&
      typeof row['resolved'] === 'string' &&
      typeof row['note'] === 'string'
    );
  }
  return false;
}

/** Fold one recipient's events (posts + resolves) into InboxItems, oldest first (sequential id order). */
function foldItems(events: InboxEvent[]): InboxItem[] {
  const byId = new Map<string, InboxItem>();
  for (const event of events) {
    if (event.kind === 'post') {
      byId.set(event.id, {
        id: event.id,
        from: event.from,
        to: event.to,
        created: event.created,
        body: event.body,
        resolved: false,
      });
    } else {
      const existing = byId.get(event.id);
      if (existing !== undefined) {
        byId.set(event.id, {
          ...existing,
          resolved: true,
          resolvedAt: event.resolved,
          resolvedBy: event.by,
          note: event.note,
        });
      }
    }
  }
  // Ids are project-global sequential integers → numeric order IS chronological order.
  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

/**
 * Next project-global inbox id: 1 + the total number of `post` events across EVERY recipient file.
 * Posts are append-only and never deleted, so the count is monotonic → the id is unique across all
 * files and sortable. No parallelism (CLAUDE.md), so count-then-append is race-free. (A sequential
 * number was substituted for a ULID by the user's decision.)
 */
function nextId(projectPath: string): string {
  let posts = 0;
  for (const phase of PHASES) {
    posts += readEvents(projectPath, phase).filter((event) => event.kind === 'post').length;
  }
  return String(posts + 1);
}

/**
 * Post a message from `from` to `to`: assign the next global id, stamp UTC now, append a `post` event
 * to the RECIPIENT's file, and return the created item. The caller validates `to`/`body` first.
 */
export function postToInbox(projectPath: string, from: Phase, to: Phase, body: string): InboxItem {
  const item: InboxItem = {
    id: nextId(projectPath),
    from,
    to,
    created: new Date().toISOString(),
    body,
    resolved: false,
  };
  appendEvent(projectPath, to, { kind: 'post', id: item.id, from, to, created: item.created, body });
  return item;
}

/**
 * The active phase's inbox: replay only ITS file (posts addressed to it live there) and filter by
 * status. `open` (default) drops resolved items; `all` returns the full history. The model never names
 * itself — the caller passes the session's active phase (no drift-prone phase argument on the tool).
 */
export function readInbox(projectPath: string, activePhase: Phase, status: InboxReadStatus): InboxItem[] {
  const items = foldItems(readEvents(projectPath, activePhase));
  return status === 'open' ? items.filter((item) => !item.resolved) : items;
}

/**
 * Resolve item `id` on behalf of `resolver`: locate the RECIPIENT file that holds it (an item lives in
 * the file named after its `to` phase — scan the closed set), reject unknown/already-resolved, else
 * append a `resolve` event to that same file. `by` (the resolver) is recorded distinctly from the
 * original `to`, so any phase may resolve an item it did not receive.
 */
export function resolveInboxItem(
  projectPath: string,
  resolver: Phase,
  id: string,
  note: string,
): InboxResolveResult {
  for (const phase of PHASES) {
    const item = foldItems(readEvents(projectPath, phase)).find((candidate) => candidate.id === id);
    if (item === undefined) continue;
    if (item.resolved) {
      return { ok: false, error: 'already_resolved', message: `inbox item '${id}' is already resolved` };
    }
    appendEvent(projectPath, phase, { kind: 'resolve', id, by: resolver, resolved: new Date().toISOString(), note });
    return { ok: true, id };
  }
  return { ok: false, error: 'unknown_id', message: `no inbox item with id '${id}'` };
}
