# Core mental model: one model, many context windows

There is exactly **one** local Ollama model. Everything else is context windows.

- Ollama's chat API is **stateless**. The model knows only what is in the `messages` array sent on a
  given call — there is no hidden server-side memory. "Memory" is the orchestrator replaying the
  accumulated history every call (`OllamaClient.chat`/`stream` in
  [src/core/llm/client.ts](../src/core/llm/client.ts)). `num_ctx` (`OLLAMA_NUM_CTX`) is a hard token
  ceiling; exceed it and Ollama silently drops the oldest tokens.
- A **"subagent" is not a new model** — it is a fresh, empty `messages` array with a one-shot system
  prompt plus a single task, run against the same Ollama, then discarded. Isolation is just a
  separate list. It inherits **its master phase's** tool array minus the three sub-agent tools (so it
  cannot nest), never the full registry — a sub-agent must not be a way around its master's gate.
- A **phase** is the unit of work and the unit of instruction. Each phase has an instruction set (its
  markdown under [rules/](../rules/)) that configures the window it runs in. Elsewhere these are
  called "skills" or "personas" — in this project the single word is **phase**.

So the design is not "personas vs. skills." It is: **which phases the user drives interactively, and
which the orchestrator spawns automatically** — see [phases.md](phases.md).

## Memory model

Each phase has its **own isolated message history**. Switching phases saves the active history and
loads the target's — no cross-phase leakage, no auto-clear. The user owns the decision to wipe
history. Spawned execution windows (Worker/Reviewer/Retro) start from an **empty** history and are
discarded after their task — except the Worker, whose history persists *across the fix loop* (so it
remembers prior attempts and Reviewer feedback) and is discarded when the task closes.

- **Manual clear:** `/clear` wipes only the active phase's history.
- **Token-threshold failsafe:** when a phase's history crosses `SUMMARIZATION_THRESHOLD_RATIO` of
  `OLLAMA_NUM_CTX`, the orchestrator summarizes the oldest turns and replaces them with a single
  summary entry. This is a safety valve against VRAM exhaustion, not normal operation.
- **Per-project persistence:** each project keeps its own per-phase memory so the model always knows
  where it stopped. Persistence lives with the project repo.
- **Documentation files** (rules, plans, specs) exist for one-time reference or human reading — they
  are not loaded into every prompt.

Minimize persistent context to save tokens; local inference is VRAM-bound. Cross-phase communication
goes through the inbox ([phases.md](phases.md)), not memory.

The summarization trigger keys off **exact** token counts from Ollama, never estimates — a
VRAM-safety invariant; see [constitution.md](../constitution.md).
