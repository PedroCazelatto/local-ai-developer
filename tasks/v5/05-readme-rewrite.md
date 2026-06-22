> **Status:** ⬜ Not started

# 05 — README rewrite

**Version:** V5
**Depends on:** V5/02 (model commands), V5/03 (`/help` registry the commands reference reuses), and **all of V1–V4** (the documented surface must exist before it's documented). Effectively the **last** task in the project.
**Blocks:** nothing — this is the closing polish that makes the repo shareable as a learning artifact.

## Why

`README.md` describes the **old Python `orchestrator/` layout** and lists commands that don't exist. After the TypeScript rewrite, the networked sandbox, the planning/execution loop, persistence, and the V5 power tools have all landed, the surface is finally stable enough to document without it going stale in three weeks. This is the **last version** — the README should match reality, not aspiration.

**Ownership constraint (firm):** the **user owns `README.md`** and it must **not be touched until the user asks** (CLAUDE.md: "The README.md is being rewritten by the user … do not edit it without being asked"). Frame this task as: *when V1–V4 + V5/01–04 have landed and the surface is stable, **propose** the rewrite to the user* — draft it, present it, and only edit `README.md` on the user's explicit go-ahead. Do not silently overwrite it.

## Behavior

When the user approves, rewrite `README.md` to reflect the **TypeScript + networked-sandbox** reality. Sections:

1. **What it is** — one paragraph. A TS/Node CLI that orchestrates a **locally-run** Ollama model (RTX 3060, zero cloud spend) to develop code projects, driven through manually-steered planning **phases**. A **learning artifact** for prompt engineering / context-window isolation / planning — explicitly **not** a VSCode/Cursor replacement, not a vibe-coding tool.
2. **How a session works** — condensed from CLAUDE.md: `run start <project>` locks the session to one project; one Ollama model, many isolated context windows; planning phases (interactive) → execution phases (automatic, sequential, no parallelism).
3. **Phases** — short list with one-line descriptions: Discovery, Design, Breakdown (interactive planning); Worker, Reviewer, Retro (automatic execution). No "persona"/"role" wording.
4. **Quickstart** — `run install`, `run start <project>`, `/new-project <name> <stack>`, then drive **Discovery** → Design → Breakdown, trigger execution. Show the actual host verbs (`run install` / `start` / `stop`) and the first in-app commands.
5. **Commands and tools reference** — **auto-generated where possible** from the same command registry `/help` reads (V5/03), so it can't drift. List the model commands (V5/02), `/subagents` (V5/01), `/help`, `/swap`, `/clear`, `/resume`, `/new-project`, `/exit`, and the model-callable tools (`read_file`, `write_file`, `edit_file`, `list_files`, `search_in_files`, `execute_command`, `run_in_project`, `inbox_*`, `search_rules`/`load_rule`, the sub-agent tools).
6. **Project layout** — replace the stale `orchestrator/` Python tree with the current **TS `src/` tree** (`src/core/{session,container,llm,ui}`, `src/phases`, `src/context`, `src/commands`, `src/tools`, `rules/{phases,standards}`, `projects/`, `docker-compose.yml`, the `run` entry). Show the per-project `.orchestrator/` artifacts (`tool_audit.jsonl`, `events.jsonl`, `PRODUCT_SPEC.md`, the inbox, per-phase memory).
7. **Roadmap** — link to [ROADMAP.md](../ROADMAP.md).
8. **Non-goals** — explicit, so contributors don't propose Cursor-replacement features: no IDE replacement, no vibe coding, no orchestrator deployment, no multi-user, no parallelism, no cross-platform yet (Windows-first), controlled-internet sandbox (not air-gapped).

## Files

- `README.md` — **edited only on the user's explicit approval.** Until then, the deliverable is a **drafted proposal** presented to the user (e.g. shown in-chat or written to a scratch file the user can review), not an edit to `README.md` itself.
- Reuses `src/commands/registry.ts` (V5/03) as the source for the auto-generated command reference — the README's command list and `/help` read the same registry.

## Notes / pitfalls

- **Do not touch `README.md` until asked.** This is the single hardest constraint on this task: the user owns the file. Draft, propose, wait for explicit approval, then edit. (CLAUDE.md.)
- **Do this genuinely last.** The README assumes V1–V4 + V5/01–04 have landed and the surface is stable; writing it earlier guarantees it goes stale. The ROADMAP places it as `v5/05`, the final task.
- **TS + networked sandbox, not the old reality.** Purge every stale Python/`orchestrator/`/`network_mode: none`/air-gapped reference. The sandbox now has **controlled internet** (hardened: rootless user, CPU/RAM caps, only the active project mounted) per the pivot — say so, and say the model still touches **only Docker, never the host**.
- **Phase terminology only.** No "persona"/"role" anywhere in the prose, the phase list, or the layout.
- **Auto-generate the command reference** from the registry rather than hand-listing — the whole point of V5/03's registry-sourced `/help` is a single source of truth the README shares.
- **Don't over-claim.** Document only what shipped; if a roadmap item didn't land, it stays in ROADMAP.md, not the README.

## Acceptance

- A drafted README is **proposed to the user** (not committed over `README.md`) covering all eight sections above; only after the user's explicit approval is `README.md` edited.
- The rewritten README reflects the **current TS `src/` layout** — no stale `orchestrator/` Python tree, no `network_mode: none` / air-gapped language.
- Every command listed in the README exists (cross-checked against `/help` / the command registry); the tools section matches the registered model-callable tools.
- The quickstart commands (`run install`, `run start <project>`, `/new-project`, drive Discovery…) work as written when followed against a fresh checkout.
- The README links to [ROADMAP.md](../ROADMAP.md) and states the non-goals (no Cursor replacement, no vibe coding, no multi-user, no parallelism, Windows-first, controlled-internet sandbox).
