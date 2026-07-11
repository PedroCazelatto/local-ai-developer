> **Status:** ✅ Completed (2026-07-11)
>
> **As built (user-approved):** verdict via the `submit_verdict` tool-call route (rides the existing
> tool-call recovery pipeline — reliable across models/hardware). Runner lives at
> `src/core/session/reviewer-runner.ts` (mirrors `worker-runner.ts`), not `src/phases/`; verdict
> types in `src/core/session/review-types.ts`. Prompt stays `rules/phases/reviewer.md` via
> `loadPhasePrompt`. Read-mostly allowlist enforced in the window (mutating tools refused, recoverable
> + audited); loop stops via the new optional `TurnContext.isComplete()`. Logic verified with
> throwaway scripts; live `run start` acceptance is the user's step.

# 01 — Reviewer phase

**Version:** V2
**Depends on:** V1/10 (Worker phase + execution trigger), V1/05 (`run_in_project`), V1/01 (phase-instruction loader)
**Blocks:** V2/02 (review integration), V2/03 (auto-commit on accept); the V3 fix loop and `raise_blocker` build on this window.

## Why

In V1 the Worker writes code but **the user is the only reviewer**. V2's first step is the
machine half of that judgment: a fresh, isolated **Reviewer** window that judges the Worker's
output against the task definition and returns a **structured verdict** the orchestrator can act
on. This is the gate that lets V2 reach its exit criterion ("see the Reviewer's verdict and
feedback, accept, find the work committed"). Per CLAUDE.md the Reviewer is a **separate fresh
window** spawned automatically — never the Worker's window, so it cannot rationalize its own work.

Scope guard: **single pass only.** The automatic implement→fix loop, `raise_blocker`, and the
Retro phase are **V3** — do not build them here. This task delivers one Reviewer turn that emits
one verdict.

## Behavior

A spawned-window phase, like the Worker: a fresh empty message history seeded with
`rules/phases/reviewer.md` as the system prompt, run against the same local Ollama, then discarded
after it emits its verdict. It does **not** inherit the Worker's history (isolation is the point).

**Input the window is told** (assembled by the orchestrator — exact wiring is V2/02):

- the **task definition** (the same task text the Worker received, incl. acceptance criteria);
- the Worker's **change summary** and the **changed-files set / diff** (capture mechanism owned by
  V2/02);
- the **test results** the Worker produced (stdout/stderr + exit code from `run_in_project`).

**What it produces — a single structured verdict.** The Reviewer's final turn must yield one
verdict object (parsed from a dedicated `submit_verdict` tool call — preferred, because it gives a
schema-validated payload — or, if tool-calling for this proves unreliable on the local model, a
single fenced ```json block the orchestrator extracts; pick one when building and note it). Shape:

```ts
type Severity = "blocker" | "major" | "minor";

interface ReviewIssue {
  severity: Severity;   // blocker/major ⇒ verdict must be "fail"
  file: string;         // project-relative path, e.g. "src/foo.ts"; "" if not file-specific
  note: string;         // concrete, actionable — what is wrong and what the fix direction is
}

interface ReviewVerdict {
  result: "pass" | "fail";
  summary: string;            // 1–3 sentences: the overall judgment
  issues: ReviewIssue[];      // [] when result === "pass"; non-empty when "fail"
}
```

Consistency the orchestrator enforces after parsing: `result === "pass"` ⇒ `issues` has no
`blocker`/`major` entries; `result === "fail"` ⇒ at least one issue. If the model returns an
inconsistent verdict, treat it as a recoverable error and re-prompt once before surfacing failure
to the user.

**Read-mostly.** The Reviewer judges; it does not implement. It gets the **read/inspect** tools
only — `read_file`, `search_in_files`, `list_files`, and `run_in_project` (to re-run the tests /
build itself rather than trust the Worker's transcript). It is **not** given `write_file`,
`edit_file`, or the commit tool. `execute_command` is read-mostly by nature (it runs in the root
sandbox at `/workspace`); allow it but the prompt steers the Reviewer toward inspection, not
mutation. Standards retrieval (`search_rules`/`load_rule`) is a V4 capability — `reviewer.md`
already references it, but those tools won't exist until V4; the Reviewer simply won't have them in
V2 and judges conventions from its prompt.

The two review axes come straight from `rules/phases/reviewer.md`: **behavior** (does it do what
the task says, including edge cases) and **standards** (architecture, naming, testing
conventions). Both must pass for `result: "pass"`.

`reviewer.md` mentions `raise_blocker` and `AGENT_NOTES.md` — both are **out of scope for V2**
(`raise_blocker` is V3/02; the inbox is V3/04). In V2 the Reviewer has no `raise_blocker` tool, so
a genuinely ambiguous task simply comes back as a `fail` with the ambiguity called out in
`summary`/`issues`, and the user decides. The prompt does not need rewriting for V2, but the
orchestrator must not wire tools that don't exist yet.

## Files

- `src/phases/reviewer.ts` *(new)* — the Reviewer phase: builds the seed messages from
  `rules/phases/reviewer.md`, declares its read-mostly tool allowlist, runs one turn against the
  Ollama provider, parses + validates the `ReviewVerdict`, returns it to the caller (V2/02 consumes
  it). Discards the window after.
- `src/phases/types.ts` *(new or extend)* — `ReviewVerdict`, `ReviewIssue`, `Severity` exported
  here so V2/02 and the REPL renderer share one definition. No `any`.
- `src/tools/submit-verdict.ts` *(new, if the tool-call route is chosen)* — a phase-scoped tool the
  Reviewer calls exactly once with the verdict payload; the orchestrator captures the args as the
  verdict and ends the turn. Autonomous + audit-logged like every tool.
- `rules/phases/reviewer.md` *(do not edit in this task)* — already written; referenced as the
  source of the two-axis behavior. Any rewrite to drop the V3-only `raise_blocker`/`AGENT_NOTES`
  references is a separate, user-reviewed change (global rule edits are never auto-committed — see
  V2/03).

## Notes / pitfalls

- **Isolation:** the Reviewer window must start **empty** — never seeded with the Worker's message
  history. Mixing them defeats the independent-judge design in CLAUDE.md's Memory model.
- **Tokens are exact:** read `prompt_eval_count` / `eval_count` from the Ollama response for the
  Reviewer turn; never estimate from string length. Surface the metric to the status line /
  audit log. If a count is missing, say so — don't guess.
- **Tools autonomous + logged + recoverable:** every Reviewer tool call (incl. `run_in_project`
  and `submit_verdict`) is logged to the audit log with no confirmation prompt, and returns a
  structured recoverable error rather than throwing and killing the turn.
- **Sandbox boundary:** all Reviewer file reads / command runs happen inside Docker against
  `/workspace` (root sandbox) and the project container (`run_in_project`) — never the host.
- **Verdict is the only contract:** downstream (V2/02) keys off the parsed `ReviewVerdict`, not
  off free-text. Validate the shape and the pass/fail-vs-issues consistency before returning;
  re-prompt once on a malformed verdict.
- **Don't smuggle in V3:** no fix loop, no auto re-spawn, no `raise_blocker`, no Retro, no inbox.
  One spawn, one verdict, hand back to the user.

## Acceptance

Verify by driving a live `run start` session on a real project that has at least one task the
Worker has already attempted:

- After a Worker run, the orchestrator spawns a Reviewer in a **fresh** window (visible: its
  history is empty at start; it does not echo the Worker's turns).
- The Reviewer issues real read/inspect tool calls (e.g. `read_file`, `run_in_project` to re-run
  the tests) — every call appears in the audit log — and issues **no** `write_file`/`edit_file`/
  commit calls.
- The Reviewer ends with exactly one parsed `ReviewVerdict` whose shape validates: `result` is
  `"pass"` or `"fail"`, `summary` is non-empty, and `issues` obeys the consistency rule (empty on
  pass; ≥1 with no blocker/major contradicting a pass).
- Given a deliberately broken Worker output (e.g. failing tests), the verdict is `"fail"` with at
  least one concrete issue naming the offending file and a fix direction.
- The Reviewer turn's token usage in the status line / audit log comes from Ollama's exact counts.
