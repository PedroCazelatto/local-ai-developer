# Open questions

Decisions that are genuinely undecided. If one of these blocks a task, **ask the user** — do not pick
a default. When one is settled, delete it from here and write the answer into the doc that owns the
topic.

- **Sandbox network hardness** — open egress vs. an allowlist/registry proxy; persistent root sandbox
  vs. ephemeral `--rm`-per-command containers. See [sandboxing.md](sandboxing.md).
- **Project stacks** — whether stacks beyond `node` / `python` are worth scaffolding (add on demand).
- **Summarization thresholds** — who decides the trigger point, an orchestrator heuristic or the
  model's self-report. See [mental-model.md](mental-model.md).
- **Throwaway-context model** — which LLM (and which context size) powers the one-shot contexts
  (`search_rules`, summarization, commit messages, context titles, and the three windows of a `debate`):
  the same local model, or a smaller/faster one. A debate raises the stakes on this one — it spends up to
  eleven of those calls, and both debaters are asked to reason rather than to retrieve. See
  [rules-loading.md](rules-loading.md) and [phases.md](phases.md).
- **Project artifact bootstrap** — whether the orchestrator auto-initializes project artifacts on
  session start, or creation is left to the scaffold/Discovery phase.
