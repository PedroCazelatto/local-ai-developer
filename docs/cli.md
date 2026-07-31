# CLI, model selection & environment

## Host commands

npm scripts wrapping the cross-platform `scripts/run.mjs` launcher:

- `npm run setup` — install Node deps and pull the sandbox image
- `npm run start -- <project-name>` — start a session for a project
- `npm run stop` — shut down Docker
- `npm run typecheck` — `tsc --noEmit`

The launcher also runs directly: `node scripts/run.mjs install | start <project> | stop`.

> [!IMPORTANT]
> **Never run the full app to test a change.** See the working rules in
> [CLAUDE.md](../CLAUDE.md) — only `npm run setup` and `npm run typecheck` may be run.

## In-app commands (terminal)

- `/swap <phase>` — switch the active phase
- `/new-project <name> <stack>` — scaffold a new project (`node` | `python`)
- `/run <selector>` — run backlog tasks (`next` | a task id | `all`)
- `/answer <task-id> <text>` — resolve a raised blocker (re-queues the task)
- `/questions` — answer the `ask_user` questions you skipped (delivered to the asking phase on its
  next turn)
- `/models list | pull <name> | use <name>` — manage the active model
- `/clear` · `/resume` — clear or restore the active phase's history
- `/subagents` — list active sub-agents
- `/help` — list every command · `/exit` — quit

These are **user commands, and the model never invokes them.** Where the model needs the same
capability, it gets a separate **tool with its own guardrails** — a `switch_phase` tool rather than
access to `/swap` — so the orchestrator keeps control of what a phase can actually do, and each
capability can be narrowed independently of the command the user drives.

## Composing a multi-line message

**Enter** sends the message; **Shift+Enter** breaks the line instead, so a message can span as many
lines as you like and the whole block is sent as one message when you finally press Enter. The break
is a real character in the edit buffer, not a frozen row: backspace at the start of a line joins it to
the one above, and the arrows walk the whole message. The same keys work in the `ask_user` panel's
free-text answer.

> [!IMPORTANT]
> **No terminal distinguishes Shift+Enter on its own** — Enter and Shift+Enter both arrive as a
> carriage return, so a plain Shift+Enter simply sends the message. The orchestrator reads a **bare
> line feed** (`0x0A`) as the line break, which means Shift+Enter has to be bound to send one.
> **Ctrl+J** already sends exactly that on every platform, and **Alt+Enter** works too — either one
> composes a multi-line message with no configuration at all.

Binding Shift+Enter, per terminal:

| Terminal | Where | Binding |
|---|---|---|
| Windows Terminal | `settings.json` → `actions` | `{ "command": { "action": "sendInput", "input": "\n" }, "id": "User.sendNewLineInput" }` and, in `keybindings`, `{ "id": "User.sendNewLineInput", "keys": "shift+enter" }` |
| VS Code terminal | `keybindings.json` | `{ "key": "shift+enter", "command": "workbench.action.terminal.sendSequence", "args": { "text": "\n" }, "when": "terminalFocus" }` |
| iTerm2 | Settings → Keys → Key Bindings | Shift+↩ → *Send Hex Code* → `0x0a` |
| kitty | `kitty.conf` | `map shift+enter send_text all \x0a` |

## Typing while the model works

The input box does not go away for the length of a turn: its rule, the `›` row, and the rule below it
are pinned above the status lines, and what you type goes into that row instead of into the streaming
reply.

**Enter queues the message rather than sending it.** Queued messages run in the order you wrote them
as soon as the turn finishes — each one exactly as if you had typed it at the prompt, a `/command`
included — and each is announced in the scrollback (`⏳ queued: …`) the moment you press Enter, so a
queued message is never indistinguishable from a dropped one.

**↑ takes the newest queued message back** into the row to edit, and says so in the scrollback too. It
replaces whatever is in the row at the time. Editing there is deliberately just backspace: the full
buffer — history, arrows, multi-line composition — belongs to the prompt, which reopens with anything
you typed but did not queue already in it.

## Model selection

**There is no default model.** A model name compiled into the orchestrator says nothing about what
the user has actually pulled — a hard-coded default locks a fresh install to a model that isn't
there, and every turn fails. The **installed set is the only ground truth**, so boot asks the Ollama
daemon and picks from what exists
([src/core/session/resolve-boot-model.ts](../src/core/session/resolve-boot-model.ts)):

1. `state.json`'s `activeModel`, **if it is installed** — the user's own explicit choice always wins.
2. `state.json`'s `activeModel`, **if it is not installed** — offer to re-pull it (single-keypress y/n).
3. Otherwise — the **smallest installed model**. VRAM is the binding constraint, so an unattended
   boot lands on the model most likely to fit.
4. **Nothing installed at all** — offer to pull `SUGGESTED_MODEL`, which exists *only* as this
   download suggestion for a fresh machine and is never a value the session silently boots on.
5. **Every offer declined** — no model. This is a valid session, not an error: the REPL still boots
   (so the user can `/models pull`), the status line reads `no model`, and a turn fails with an
   actionable "pull one" line instead of an Ollama 404.

A declined pull is never chased with a second offer for a different model — **one ask per boot**.

Only an explicit `/models use` writes `state.json`, so an inferred boot pick never overwrites a
stated choice. **An unreachable Ollama daemon is fatal at boot** — like a missing Docker daemon: boot
needs the installed list to decide anything, and a session without Ollama can do nothing at all.

## Environment

[.env.example](../.env.example) holds:

- `OLLAMA_NUM_CTX` — the hard token ceiling per context window.
- `SUMMARIZATION_THRESHOLD_RATIO` — compact a phase once its exact `prompt_eval_count` reaches this
  fraction of `OLLAMA_NUM_CTX`. Must be in `(0, 1]`.

The model name is deliberately **not** an env var: it lives in the UI (`/models`, persisted to
`state.json` — see *Model selection* above). The active phase will eventually follow.
