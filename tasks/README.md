# Tasks

Executable acceptance criteria for the roadmap in [../ROADMAP.md](../ROADMAP.md), grouped by
version. Each version folder holds numbered task files in suggested execution order.

```
tasks/
  foundation/   # the TypeScript rewrite skeleton — gate for everything
  v1/           # the usable loop (Worker writes, you review)
  v2/           # automated Reviewer
  v3/           # full autonomous loop
  v4/           # knowledge + memory
  v5/           # power tools + polish
```

## How to read a task

**Foundation and V1 tasks are written to be executed cold** — a fresh agent with no chat history
should be able to complete one with only that task file plus [../CLAUDE.md](../CLAUDE.md). They
restate the relevant constraints instead of assuming you remember a prior conversation.

V2–V5 tasks are solid but lighter; expect to refine them just-in-time when you reach that version.

## Status legend

Add a status line at the very top of a task file as work progresses:

```
> **Status:** ⬜ Not started   (also: 🟡 In progress · ✅ Completed (YYYY-MM-DD) · ⏸ Blocked)
```

## Task file template

Every file follows this shape. Keep prose tight; the model and future-you both scan these.

```markdown
> **Status:** ⬜ Not started

# <NN> — <Imperative title>

**Version:** <Foundation | V1 | … | V5>
**Depends on:** <task refs, or "nothing">
**Blocks:** <what this unblocks, optional>

## Why
<1–3 sentences. The problem this solves and why it's sequenced here. Reference the
relevant CLAUDE.md rule or roadmap exit criterion.>

## Behavior
<What the thing does, from the outside. For tools: the exact signature and the
structured result/error shape. For UI: what the user sees. For phases: what the
window is told and what it produces.>

## Files
<New and touched files, with a one-line note each. Use the TS source tree, not the
old Python layout.>

## Notes / pitfalls
<Constraints that are easy to get wrong: token-count exactness, sandbox boundaries,
network posture, isolation between phase histories, append-only/replay storage, etc.>

## Acceptance
<Concrete, checkable criteria — ideally a live `run start` scenario, not a unit test.
Each bullet is something you can verify by driving the app.>
```

## Conventions that apply to every task

- **Platform:** TypeScript on Node. The Python code under the repo root is **reference only** and is
  deleted once the TS build reaches parity. Never add new Python.
- **Terminology:** the unit of work and instruction is a **phase** (Discovery, Design, Breakdown,
  Worker, Reviewer, Retro). No "persona"/"role" naming in the new code.
- **Sandbox:** the model acts **only inside Docker**, with **controlled internet** (hardened:
  rootless user, CPU/RAM caps), and **only the active project** mounted at `/workspace`. Never the
  host filesystem.
- **Tokens are exact:** read `prompt_eval_count` / `eval_count` from Ollama. Never estimate from
  string/char length. If a metric is missing, surface that — don't substitute a guess.
- **Tools run autonomously** (no confirmation prompts) and **every call is logged** to the audit log.
- **Errors are recoverable:** a tool returns a structured error the model can read and retry from,
  rather than throwing and killing the turn.
- **No parallelism:** phases run one at a time, sequentially.
