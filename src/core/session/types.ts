// The vocabulary core/session speaks — every type no single function in the folder owns.
//
// The constitution's rule: a type lives in the file that owns the function it describes, and a type
// no function owns lives in the folder's `types.ts`. "No function owns it" is not a judgement call to
// agonise over — when several peer functions all produce or consume a shape and none of them is
// plainly its author (a create/switch pair, a save/pop/drop trio, a diff/log/show trio), that is
// itself the signal, and the shape belongs here. `review-types.ts` was a second spelling of this same
// file and has been merged in; `types.ts` is the one mandated spelling per folder.

// ---------------------------------------------------------------------------------- task backlog
// The backlog is a tree of Markdown files under <projectRoot>/backlog/ (COMMITTED — a human-browseable
// plan + progress trail): up to three levels — an epic folder, a story folder, and a task file — where
// ONLY task files are required. A task may sit directly in backlog/, or under an epic, or under an
// epic + story. Each epic/story folder MAY hold a README.md documenting that level; every other .md is
// a task carrying YAML frontmatter (status/order/depends_on) plus a Markdown body (the definition +
// acceptance the Worker is seeded with).
//
// The PATH is the identity: a task's id is its path relative to backlog/ without the ".md" extension,
// e.g. "epic-auth/story-signup/01-add-hashing-test". depends_on entries are these same ids. Statuses
// flip in each file's frontmatter as execution runs; PRODUCT_SPEC.md stays the narrative.
// (Supersedes the earlier single .orchestrator/backlog.json decision.)

/** pending -> in_progress -> done, plus blocked. In V1, `done` is user-gated (no auto-Reviewer). */
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'done', 'blocked'];

export interface Task {
  /** Stable id = path under backlog/ without ".md", e.g. "epic-auth/story-signup/01-hash-test". */
  readonly id: string;
  /** Absolute host path to the task's .md file. */
  readonly filePath: string;
  /** Title: the body's first H1, else the humanized file slug. */
  readonly title: string;
  /** Full Markdown body after the frontmatter — the definition + acceptance the Worker is seeded with. */
  readonly body: string;
  /** Task ids (backlog-relative paths) that must be `done` before this is eligible; [] if none. */
  readonly dependsOn: readonly string[];
  /** Global execution-sequence index across the whole backlog (frontmatter `order`). */
  readonly order: number;
  readonly status: TaskStatus;
  /** Owning epic slug (top folder under backlog/), or null when the task isn't under an epic. */
  readonly epic: string | null;
  /** Owning story slug (second folder), or null when the task isn't under a story. */
  readonly story: string | null;
}

export interface Backlog {
  /** Every task in the tree, sorted by `order` then `id`. */
  readonly tasks: readonly Task[];
}

// --------------------------------------------------------------------------------- review verdict
// Review verdict types (V2/01) — the ONLY contract between a spawned Reviewer window and its
// consumers (V2/02 review integration + the REPL renderer). A Reviewer judges ONE Worker attempt
// and emits exactly one ReviewVerdict; downstream keys off this parsed, validated shape — never off
// free text. They live here, in the folder's vocabulary file, so the runner that produces a verdict
// and the interface that renders one share one definition without either importing the other.

/** blocker/major on a verdict force result "fail"; a "minor" may accompany a "pass". */
export type Severity = 'blocker' | 'major' | 'minor';

export const SEVERITIES: readonly Severity[] = ['blocker', 'major', 'minor'];

export interface ReviewIssue {
  /** blocker/major ⇒ the verdict must be "fail"; minor may ride along on a pass. */
  readonly severity: Severity;
  /** Project-relative path, e.g. "src/foo.ts"; "" when the issue isn't file-specific. */
  readonly file: string;
  /** Concrete + actionable: what is wrong and the fix direction (never a vague "looks off"). */
  readonly note: string;
}

export interface ReviewVerdict {
  readonly result: 'pass' | 'fail';
  /** 1–3 sentences: the overall judgment. Always non-empty. */
  readonly summary: string;
  /** Empty when a "pass" carries no findings; ≥1 when "fail". Never a blocker/major on a pass. */
  readonly issues: readonly ReviewIssue[];
}

/**
 * The user's call after seeing a verdict (V2/02): commit + mark done, hand back for a manual Worker
 * fix (leave uncommitted), or move on (leave uncommitted). Only "accept" ever triggers the commit.
 */
export type ReviewDecision = 'accept' | 'sendBack' | 'skip';

// ------------------------------------------------------------------------------- model-facing git
// Outcome shapes shared by peer git operations, each set authored by no one of them: create/switch
// both build a BranchResult, save/pop/drop all build a ShelfResult, and diff/log/show all build an
// InspectResult. The shapes a single function does own stay with it — BranchList with listBranches,
// Shelf with listShelves, PushResult with pushCurrentBranch, GitRun with runGit.

/** The outcome of a create / switch. `error` is set exactly when `ok` is false. */
export interface BranchResult {
  readonly ok: boolean;
  /** The branch now checked out (on success), or the one that was asked for (on failure). */
  readonly branch: string;
  /**
   * True when `create` found the branch already there and switched to it instead. The caller reports
   * this back so a re-run reads as "resumed", never as "created twice".
   */
  readonly existed: boolean;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}

/** The outcome of a save / pop / drop. `error` is set exactly when `ok` is false. */
export interface ShelfResult {
  readonly ok: boolean;
  /** The label acted on. */
  readonly label: string;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}

/** The outcome of a read-only diff / log / show. Every one of them is bounded. */
export interface InspectResult {
  readonly ok: boolean;
  /** The bounded output. "" when there is nothing to show (a clean diff, an empty log). */
  readonly output: string;
  /** True when the output was cut to fit the budget — the model is told, never left guessing. */
  readonly truncated: boolean;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}

// --------------------------------------------------------------------------- host-global app state
// The shape persisted to ~/.local-ai-developer/state.json (V5/02). HOST-WIDE, not per-project: the
// model is a hardware choice, agnostic to which project is open. Every field is optional so a partial,
// older or empty state.json still loads.

/** The shape persisted to ~/.local-ai-developer/state.json. Grows over time; keep every field optional. */
export interface AppState {
  /**
   * The model name the user last selected via `/models use` — their explicit choice, so it outranks
   * anything the orchestrator would infer. It is a preference, NOT a guarantee: the blob can be deleted,
   * or the file can be carried to a machine that never pulled it, so boot verifies it against the
   * installed set before honouring it and offers to re-pull it when it's gone (resolve-boot-model.ts).
   * Absent (fresh install / never switched) → boot picks the smallest installed model.
   */
  readonly activeModel?: string;
}

// ----------------------------------------------------------------------------------- blocker store
// The blockers.jsonl row format (V3/02). A blocker is the Reviewer's "I cannot judge this -- the task
// itself is ambiguous" signal. The three move together because BlockerRow is a union OVER the other
// two: splitting them would put a union in one file and its members in others, and make this file
// import from a function file.

/** A blocker the Reviewer raised (persisted as a `raised` row). */
export interface RaisedBlocker {
  /**
   * `${taskId}#${n}` — n is a 1-based counter of blockers raised for THIS task (a task can be
   * re-blocked across re-runs). Human-readable + sortable within a task, and the key a `resolved`
   * row references. The user chose this over a ULID (there is no id dependency yet — V3/04's inbox).
   */
  readonly id: string;
  /** The backlog task id (path under backlog/ without .md) the blocker was raised on. */
  readonly taskId: string;
  /** The fix-loop round (1..MAX_ROUNDS) the blocker was raised on. */
  readonly round: number;
  /** The Reviewer's question — surfaced to the user, answered later via /answer. */
  readonly question: string;
  /** UTC ISO-8601 ms, when the blocker was raised. */
  readonly raisedAt: string;
}

/** The user's answer to a blocker (persisted as a `resolved` row referencing the raised `id`). */
export interface ResolvedBlocker {
  /** The `id` of the `raised` row this answers. */
  readonly id: string;
  /** The user's answer text (from /answer). */
  readonly answer: string;
  /** UTC ISO-8601 ms, when the user answered. */
  readonly resolvedAt: string;
}

/** One append-only row in blockers.jsonl, discriminated by `kind`. State = replay of these rows. */
export type BlockerRow =
  | ({ readonly kind: 'raised' } & RaisedBlocker)
  | ({ readonly kind: 'resolved' } & ResolvedBlocker);

// ---------------------------------------------------------------------------------- question store
// The questions.jsonl row format. A question is durable the moment the user declines to answer it, so
// nothing the model asked is silently lost across a turn, a phase swap or a restart.

/** A question the user left unanswered, persisted as an `asked` row and re-asked by /questions. */
export interface PendingQuestion {
  /**
   * `${phase}#${n}` — n is a 1-based counter of questions ever saved for THIS phase. Human-readable
   * and stable, matching the blocker store's id scheme (chosen over a ULID there, so kept here too).
   */
  readonly id: string;
  /** The phase whose window asked it — it is the one that gets the answer back. */
  readonly phase: string;
  readonly question: string;
  /** The options the model offered, replayed verbatim when /questions re-asks it. */
  readonly options: readonly string[];
  /** UTC ISO-8601 ms, when the question was saved. */
  readonly askedAt: string;
}

/** A pending question the user has since answered, waiting to be handed to its phase. */
export interface AnsweredQuestion {
  readonly id: string;
  readonly phase: string;
  readonly question: string;
  /** The chosen option or free text the user gave via /questions. */
  readonly answer: string;
  /** UTC ISO-8601 ms, when the user answered. */
  readonly answeredAt: string;
}

/**
 * One append-only row in questions.jsonl, discriminated by `kind`. State = replay of these rows:
 * `asked` with no `answered` is pending; `answered` with no `delivered` is waiting to reach its
 * phase's context. `delivered` is what stops an answer being injected into the same window twice.
 */
export type QuestionRow =
  | ({ readonly kind: 'asked' } & PendingQuestion)
  | { readonly kind: 'answered'; readonly id: string; readonly answer: string; readonly answeredAt: string }
  | { readonly kind: 'delivered'; readonly id: string; readonly deliveredAt: string };

// ------------------------------------------------------------------------------- cross-phase inbox
// The inbox row format (V3/04) and its closed phase set -- how one phase signals another despite each
// phase window having its OWN isolated history. Replaces the fragile AGENT_NOTES.md markdown file.

/** The closed set of phases — the only valid inbox sender/recipient (mirrors the six rules/phases files). */
export type Phase = 'Discovery' | 'Design' | 'Breakdown' | 'Worker' | 'Reviewer' | 'Retro';

/** One cross-phase message, folded from its `post` (+ optional `resolve`) event(s). */
export interface InboxItem {
  /**
   * Project-global sequential id (a plain integer as a string) — unique across every recipient file,
   * monotonic by creation (so numeric order IS chronological order), and the key a `resolve`
   * references. A simple sequential number was substituted for a ULID by the user's decision.
   */
  readonly id: string;
  readonly from: Phase;
  readonly to: Phase;
  /** UTC ISO-8601 ms, when the message was posted. */
  readonly created: string;
  readonly body: string;
  readonly resolved: boolean;
  /** UTC ISO-8601 ms — present only once resolved. */
  readonly resolvedAt?: string;
  /** The phase that resolved it — may differ from `to` (any phase may resolve). Present once resolved. */
  readonly resolvedBy?: Phase;
  /** The one-line resolution note — present only once resolved. */
  readonly note?: string;
}

/** One append-only row in a recipient's `<phase>.jsonl`, discriminated by `kind`. State = replay of these. */
export type InboxEvent =
  | {
      readonly kind: 'post';
      readonly id: string;
      readonly from: Phase;
      readonly to: Phase;
      readonly created: string;
      readonly body: string;
    }
  | {
      readonly kind: 'resolve';
      readonly id: string;
      readonly by: Phase;
      readonly resolved: string; // UTC ISO-8601 ms
      readonly note: string;
    };

/** `inbox_read`'s status filter: only-open (default) or the full history including resolved items. */
export type InboxReadStatus = 'open' | 'all';

/** Why an `inbox_post` was rejected (structured, recoverable — the model reads it and retries). */
export type InboxPostError = 'unknown_to_phase' | 'empty_body';

/** Why an `inbox_resolve` was rejected (structured, recoverable). */
export type InboxResolveError = 'unknown_id' | 'already_resolved';

/** `inbox_resolve` outcome: the resolved id, or a structured rejection (never a thrown error). */
export type InboxResolveResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly error: InboxResolveError; readonly message: string };
