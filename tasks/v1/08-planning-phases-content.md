> **Status:** ✅ Completed (2026-07-09) — drift-fix applied to `discovery.md` / `design.md` / `breakdown.md` (dropped `AGENT_NOTES.md`; deferred `search_rules`/`load_rule` as V4; softened cross-phase sections; aligned `PRODUCT_SPEC.md` section names). **Revised 2026-07-10:** `breakdown.md` now targets the `backlog/` Markdown tree (V1/09, revised) instead of `.orchestrator/backlog.json`. Those three `rules/` edits + this status line are left **UNCOMMITTED** for user review (constitution: global instruction files are never auto-committed).

# 08 — Planning-phase content (Discovery / Design / Breakdown)

**Version:** V1
**Depends on:** V1/01 (phase-instruction loader injects these as system prompts), V1/03 (the tools they call to write artifacts), V1/09 (the backlog format they produce).
**Blocks:** V1/10 (the Worker consumes the backlog these phases produce).

## Why

The planning phases drive **Idea → Epics → Stories → Tasks** interactively (CLAUDE.md, "Planning phases"). Their instruction sets are the markdown under `rules/phases/{discovery,design,breakdown}.md` — written **for the local Ollama model, not for Claude**. The files already exist (Foundation predates this), but they were drafted before the backlog format and the inbox were settled, so they have **drift**. This task is to **read the three files, identify the drift, and fix it** so the phases reference the right artifacts and the available tools, while staying interactive and non-linear.

## What to validate / align

Read `rules/phases/discovery.md`, `design.md`, `breakdown.md` first, then reconcile against the V1 decisions:

1. **Backlog reference (V1/09).** Breakdown currently says it "Append[s] them to the project's ordered task backlog" without naming a format. Align it to write the backlog at **`.orchestrator/backlog.json`** in the V1/09 schema (Epic→Story→Task, ids `E1`/`E1-S1`/`E1-S1-T1`, `order`, `depends_on`, `status: "pending"`), via the `write_file`/`edit_file` tools. Discovery/Design should reference where epics/stories land (`PRODUCT_SPEC.md` for narrative; the backlog is seeded/extended by Breakdown).

2. **`AGENT_NOTES.md` → inbox.** All three files have a "Communicating with other phases" section built on `AGENT_NOTES.md` (Discovery even *creates* it: "Create `AGENT_NOTES.md` if it does not exist"). The pivot/ROADMAP supersede `AGENT_NOTES.md` with the `.orchestrator/inbox/` mechanism — **but the inbox tooling is V3**, not V1. Resolve the drift conservatively: **remove the instruction to create/maintain `AGENT_NOTES.md`** (the scaffold no longer makes it — V1/07), and soften the cross-phase sections to "note concerns for other phases in your summary to the user" for V1, with a forward note that a structured inbox arrives in V3. Do **not** invent inbox tool calls the model can't make yet.

3. **Tool references.** The files mention `search_rules`/`load_rule` (Design, Worker) — those are **V4**, not available in V1. For the V1 planning phases, ensure they reference only tools that exist now: `read_file`, `write_file`, `edit_file`, `list_files`, `search_in_files` (V1/03), and that they actually use `write_file`/`edit_file` to persist `PRODUCT_SPEC.md` and (Breakdown) `backlog.json`. Either drop the `search_rules`/`load_rule` mentions for V1 or mark them clearly as not-yet-available so the model doesn't hallucinate the call. (Don't add V4 tooling; just don't have the prompt promise it.)

4. **Artifact section names.** Align the `PRODUCT_SPEC.md` section names the phases write to the scaffold skeleton (V1/07): `Vision`, `Domain Glossary`, `Epics`, `Stories`, `Architecture`, `Execution Sequence`. Fix any mismatch (e.g. "User Stories" vs "Stories", "Architectural Map" vs "Architecture") so phases edit the sections that actually exist.

5. **Non-linearity preserved.** Keep the phases interactive and explicitly loopable (Discovery ⇄ Design ⇄ Breakdown): the user can revise scope, re-architect, or re-sequence at any time before triggering execution. Don't turn them into a one-shot pipeline.

6. **Questions-over-assumptions intact.** Discovery's "never guess — ask", bounded rounds (≤5 questions), and "validate before advancing" are correct — keep them. Same for Design's "boundaries before detail" / vertical-slice stories and Breakdown's "one story at a time" / "order by dependency then value". The mission/behavioral guidance is sound; the **drift is in the artifact/tool/communication references**, not the core method.

## Deliverable

For each of the three files, a concrete edit list (the task agent reads them and writes the diffs):
- Discovery: drop `AGENT_NOTES.md` creation; align `PRODUCT_SPEC.md` sections; confirm it writes via `write_file`.
- Design: align story/architecture section names; remove/flag `search_rules`/`load_rule`; soften the `AGENT_NOTES.md` section.
- Breakdown: point it at `.orchestrator/backlog.json` in the V1/09 schema (ids, `order`, `depends_on`, `status`); soften the `AGENT_NOTES.md` section.

## Files

- `rules/phases/discovery.md` — edit (drift fixes above). **This is the one task that edits the phase markdowns** (the others in V1 only consume them).
- `rules/phases/design.md` — edit.
- `rules/phases/breakdown.md` — edit.
- (No TS files — this is content alignment. The loader is V1/01.)

## Notes / pitfalls

- **These are instructions for the LOCAL model, not Claude** — write plainly, concretely, with the exact filenames/paths the model will use (`.orchestrator/backlog.json`, `PRODUCT_SPEC.md`). A local model follows explicit instructions far better than implied ones.
- **Don't promise tools that don't exist in V1.** `search_rules`/`load_rule` (V4) and inbox tools (V3) will make the model emit calls the dispatcher rejects. Strip or clearly defer them.
- **Backlog is gitignored session state** (V1/07/09); `PRODUCT_SPEC.md` is the committed narrative. Make the phases write each to the right place.
- **Stay non-linear** — these phases loop; don't bake in a forced order.
- Edits are picked up live (V1/01 re-reads on activation), so iterate by `/swap`-ing.

## Acceptance

- On a fresh `/new-project`, driving Discovery produces/updates `PRODUCT_SPEC.md` with the scaffold's section names filled (Vision, Epics, versioned scope) and **no `AGENT_NOTES.md`** is created.
- Design records architecture + stories into `PRODUCT_SPEC.md`'s `Architecture`/`Stories` sections (names that actually exist in the skeleton).
- Breakdown writes `.orchestrator/backlog.json` validating against V1/09 (epics→stories→tasks with `id`, `order`, `depends_on`, `status: "pending"`).
- Across a Discovery→Design→Breakdown→back-to-Design loop, no phase emits a `search_rules`/`load_rule`/inbox tool call (would be a dispatcher "unknown tool" error) — confirming the prompts don't promise V3/V4 tooling.
