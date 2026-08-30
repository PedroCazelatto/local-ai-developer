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

## Node version

`.nvmrc` (`24.14.0`) is the **single source of truth** for the Node version this repo runs on.
`package.json`'s `engines` range and the sandbox image tag both follow it; when the pin moves, they
move with it. The floor stays at 24 — not because `node:sqlite` forces it (it demonstrably works
unflagged on 22 as well), but because a repo that pins one version in four places and enforces none of
them tells you nothing about what it was tested on.

- **Making the shell honour `.nvmrc` is the real fix, and it is machine setup — no code.** A shell on
  the wrong Node is a shell that was never switched; an `nvm use` on entering the repo (or the
  equivalent for whatever version manager is installed) is what actually prevents the problem.
- **The Docker sandbox runs the same version.** The root sandbox image tag is derived from `.nvmrc`,
  so the Node a project's code is built and tested against is the Node the orchestrator itself runs
  on — not a floating major tag free to drift a whole minor ahead of the pin. See
  [sandboxing.md](sandboxing.md).
- **`run.mjs` checks at the front, and treats its verbs differently.** `start` **refuses** on a Node
  outside the range, naming the version required and the version found; `install` **warns and
  continues**, because an install on the wrong Node still produces a usable `node_modules` and the
  refusal belongs where a walk-away batch would otherwise fail hours later. `stop` is never gated:
  shutting Docker down has to work on any Node.

## In-app commands (terminal)

- `/swap <phase>` — switch the active phase
- `/new-project <name> <stack>` — scaffold a new project (`node` | `python`)
- `/run <selector>` — run backlog tasks (`next` | a task id | `all`)
- `/answer <task-id> <text>` — resolve a raised blocker (re-queues the task)
- `/questions` — answer the `ask_user` questions you skipped (delivered to the asking phase on its
  next turn)
- `/models list | pull <name> | use <name>` — manage the active model
- `/clear` — start the active phase on a new context (the old one is kept, not wiped)
- `/resume [<address>]` — reopen one of the active phase's earlier contexts, by address
  (`design/7a888b1f`) or from a numbered list. See the memory model in
  [mental-model.md](mental-model.md).
- `/subagents` — list active sub-agents
- `/tasks` — the backlog as an epic/story tree: each task's status, order and unmet dependencies, with
  the one `/run next` would pick marked
- `/blockers` — every open blocker with its task id, the Reviewer's question, and the `/answer` line
  that resolves it
- `/inbox [<phase> | all]` — open cross-phase inbox items: the active phase's, one named phase's, or
  every phase's. Open items only
- `/batch [n]` — re-print a persisted batch summary; `n` is the batch number the report itself prints
  (`Batch #3`), and a bare `/batch` is the most recent
- `/audit [n]` — the last N tool calls, one line each (`HH:mm:ss · phase · tool · exit · duration`).
  Default 20, and a larger number is not capped
- `/stop` · `/stop round` — wind a running `/run` down (see *Stopping a turn* below); typed into the
  fenced input box while the run is in flight, not at an idle prompt
- `/help` — list every command · `/exit` — quit

These are **user commands, and the model never invokes them.** Where the model needs the same
capability, it gets a separate **tool with its own guardrails** — a `switch_phase` tool rather than
access to `/swap` — so the orchestrator keeps control of what a phase can actually do, and each
capability can be narrowed independently of the command the user drives.

### The inspection commands

`/tasks`, `/blockers`, `/inbox`, `/batch` and `/audit` are the **come-back half of the walk-away
loop**: start a batch, walk away, come back and read what happened without quitting the session.
Every one of them is a **pure read** of a file the orchestrator had already written under
`projects/<name>/.orchestrator/` — no new persistence, no model call, nothing that can change a run.

Two of them mark the boundary of what a phase may see, and the asymmetry is deliberate:

- **`/inbox` has a model counterpart, narrowed.** A phase reads its own inbox with `inbox_read`, and
  only its own — the recipient is derived from the active phase so a window can never name itself as
  someone else. `/inbox all` is the user's view across every phase, which no phase gets.
- **`/audit` has none at all.** The audit log is the user's record of autonomous, no-confirmation tool
  calls, and no phase can read it. A window able to read the record of its own calls could reason
  about how they look to the user, and the log's only job is to be a record the user trusts.

Each degrades to one recoverable line when what it reads is not there — a project with no `backlog/`,
a blocker file no blocker has ever been written to, a batch number that is not on disk — the way
`/run` already degrades on a `BacklogError`.

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

## Completing a command or a task id

**Tab cycles.** It replaces the word under the cursor with the first thing that could go there; each
further press swaps in the next one, wrapping back to the first after the last — file-completion in
`cmd.exe` or fish, not bash's "extend to the common prefix, then list". Candidates come in a stable
alphabetical order, so the same number of presses always lands on the same word.

Nothing is ever printed. There is no candidate list, which is why every press visibly changes the line
instead: the pinned rows below the input are never disturbed and nothing enters the scrollback.

| Where the cursor is | What Tab offers |
|---|---|
| the command word (`/re` + Tab) | every registered command — a new one completes the day it is added |
| `/run <selector>` | `next`, `all`, and every task id that is not `done` |
| `/answer <task-id>` | only tasks sitting at `blocked` — exactly the ones the command can act on |
| `/swap <phase>` | the phase names |
| `/models <subcommand>` | `list`, `pull`, `use` |
| `/new-project <name> <stack>` | `node`, `python` (the name itself is free text) |

Anywhere else Tab is inert — a chat message, an unknown command, an argument with nothing to suggest.
**Model names are the deliberate omission:** listing them means asking the Ollama daemon, and completion
has to answer on the keypress without waiting for anything, or the pinned rows blank until the next
keystroke. `/models pull` names are arbitrary registry strings anyway.

**Shift+Tab is unbound.** It is not a reverse cycle, and it no longer switches phase — use `/swap`.

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

## Stopping a turn

**Ctrl+C stops the turn; a second Ctrl+C quits.** While something is running the first press cancels it
and hands you back the prompt — the session, every phase's history and the whole batch survive. Press it
again and it means what it always meant, so the escape hatch never disappears; it just takes two presses
while there is something worth stopping first. At the prompt, with nothing running, one press still
quits.

It works during a tool call too, not only while text is streaming: a `run_in_project npm test` can run
for minutes, and a press there stops the turn at the next model call rather than falling through and
ending the session.

**A cancelled exchange is set aside, not kept.** Your message, whatever the model had answered, and the
tool calls it made along the way all leave the phase's window together, so the prompt reopens where you
left off and you can rewrite the message that sent it down the wrong path. Nothing is destroyed: the
whole exchange stays in `memory.db` marked cancelled, and the session's events log records the turn and
what it cost. **The tokens are not refunded** — a cancelled turn had already been evaluated on the GPU,
so the phase's `Ctx` figure keeps counting them. That is the honest number, not a bookkeeping quirk.

### Winding a batch down

During `/run`, two lines typed into the fenced input box act immediately instead of joining the queue —
they have to, since the queue only drains once the run they would be stopping has finished:

| Line | Effect |
|---|---|
| `/stop` | Finish the current **task** — its verdict, its commits and all — then stop before the next one. |
| `/stop round` | Finish the current **round**, then stop. The task ends without a verdict and stays runnable. |

Both are announced in the scrollback the moment you press Enter. Neither discards work already done:
tasks the batch already finished keep their outcomes, and the end-of-batch summary lists what was stopped
separately from what failed review — an interrupted task was never judged, and reporting it as an
escalation would put a verdict in the report that no Reviewer ever gave.

`/stop` is claimed only while a run is in flight. Typed at any other time it is an unknown command, and
a stop asked for during one run never carries into the next.

## Model selection

**There is no default model.** A model name compiled into the orchestrator says nothing about what
the user has actually pulled — a hard-coded default locks a fresh install to a model that isn't
there, and every turn fails. The **installed set is the only ground truth**, so boot asks the Ollama
daemon and picks from what exists
([src/core/session/resolve-boot-model.ts](../src/core/session/resolve-boot-model.ts)).

**Tool support is a gate, and nothing infers a model behind it.** Every phase in this product is a
tool-calling loop, so a model without the `tools` capability cannot run any of it — a Worker that
cannot call `edit_file` does nothing at all, and the phase burns its five rounds looking confused
rather than failing. And **there is no size heuristic**: sorting the installed set on disk bytes and
taking the smallest was a rule that chose for the user, which is how a benchmark download could
silently re-point an unattended boot onto a 1.5b model. It is gone. The ladder is:

1. `state.json`'s `activeModel`, **installed and tool-capable** — the user's own explicit choice wins,
   with no prompt.
2. `state.json`'s `activeModel`, **installed but toolless** — **refused**, with a line saying why, and
   boot falls through to the chooser.
3. `state.json`'s `activeModel`, **not installed** — boot falls through to the chooser. There is no
   re-pull offer: with no pick rule left to fall through *to*, a missing saved model is simply an
   unresolved boot like any other.
4. **Otherwise — the user chooses.** Boot lists every installed model and waits. Toolless models are
   **shown, marked, and not selectable** (see below), so the list explains itself rather than hiding
   its own omissions.
5. **Nothing installed at all** — print recommendations and how to install one. Nothing is downloaded.
   `SUGGESTED_MODEL` exists *only* as this suggestion for a fresh machine and is never a value the
   session silently boots on.
6. **Nothing tool-capable, or the chooser declined** — no model. This is a valid session, not an
   error: the REPL still boots (so the user can `/models pull` or `/models use`), the status line
   reads `no model`, and a turn fails with an actionable line instead of an Ollama 404.

When the reason is capability rather than an empty machine, that line **says to pull a model with tool
support, and names none**. `SUGGESTED_MODEL` is a suggestion for a machine with nothing on it, and this
machine is full; naming a model whose own tool support has not been verified would only move the
problem one pull further along.

Two invariants hold across all of it:

- **Nothing is ever pulled without the user's approval**, and nothing is ever *selected* without it
  either. Every pull path — the boot suggestion, `/models pull`, and the inline offer inside
  `/models use` — is gated on an explicit keypress.
- **The gate fails closed.** A daemon that does not report capabilities at all leaves every model
  failing it, and the session boots model-less. That is the cheap direction to be wrong in: booting a
  walk-away batch onto a model that cannot call a tool costs the whole batch, while a wrongly
  model-less boot costs one `/models use` the user can drive from inside the app. **This is why the
  repo has a minimum Ollama version** — capabilities reached `/api/tags` in 0.9.1, and a daemon older
  than that makes every model look incapable.

Only an explicit `/models use` writes `state.json`, so a boot-time choice never overwrites a stated
one. **An unreachable Ollama daemon is fatal at boot** — like a missing Docker daemon: boot needs the
installed list to decide anything, and a session without Ollama can do nothing at all.

### `/models` and the toolless case

- **`/models list` marks tool support.** The list is where a user goes to ask why a model was skipped,
  so it is where the answer belongs. The same marking is what the boot chooser shows.
- **A toolless model is visible but never selectable.** `/models use <name>` on one **refuses**: it
  says the model cannot call tools and is therefore unavailable, and **asks whether to delete it**. So
  a toolless model is shown, explained, and disposable — never quietly active, and never a thing the
  user has to remember about.

  *(This reverses an earlier reading of these answers, which had `/models use` take a single-keypress
  confirm and then switch. It also leaves the `Model: <name> (no tools)` status marker with no way to
  paint — see OPEN-QUESTIONS.md #78, which is open.)*

## Environment

[.env.example](../.env.example) holds:

- `OLLAMA_NUM_CTX` — the hard token ceiling for every **window**: the interactive phases, the Worker,
  the Reviewer, Retro and sub-agents all run under exactly this value. **Changing it hides every phase
  context written under the old value** — they are not listed and cannot be reopened, because replaying
  a history built for a larger window would silently lose its oldest turns. Nothing is deleted:
  restoring the old value brings them back. It is read once at boot, so a change takes effect only on
  the next `run start`. See the memory model in [mental-model.md](mental-model.md).

  Three **throwaway one-shots** run under a smaller ceiling of their own instead — the context titler,
  `search_rules`, and the commit-message writer, at 8 192. Each has an input with a known hard maximum,
  and at 8 192 the model stays fully resident in VRAM where at 16 384 part of it spills to the CPU. The
  other three one-shots stay at `OLLAMA_NUM_CTX`: summarization is handed roughly half a full window by
  construction, and a `debate`'s material is uncapped text the model writes, so neither could take a
  smaller window without Ollama silently dropping the front of it. The values are not configurable —
  they are a table keyed by the call's role in
  [src/core/llm/resolve-window-ctx.ts](../src/core/llm/resolve-window-ctx.ts).
- `SUMMARIZATION_THRESHOLD_RATIO` — compact a phase once its exact `prompt_eval_count` reaches this
  fraction of `OLLAMA_NUM_CTX`. Must be in `(0, 1]`.
- `EVICTION_THRESHOLD_RATIO` — replace a spawned window's **older tool results** with a one-line stub
  once its exact `prompt_eval_count` reaches this fraction of `OLLAMA_NUM_CTX` (default `0.6`; must be
  in `(0, 1]`). Deliberately below the summarization ratio: eviction costs no inference, so it gets a
  run first. It applies to the **Worker**, whose window persists across all five review rounds and has
  no summarization failsafe of its own. `0.6` is a starting point, not a measured optimum.
- `OLLAMA_TIMEOUT_MS` — how long one model call may go **silent** before it is abandoned (default
  `120000`). A **stall** window, not a limit on how long a turn may take: every chunk restarts it, so a
  slow-but-alive model is never killed for being slow, while a wedged or unreachable daemon surfaces as
  one recoverable line instead of a REPL that hangs forever. A one-shot (summarization, `search_rules`,
  the context titler) receives its whole response at once and so has nothing to restart the window —
  there this value caps the entire call. A timeout is reported as a fault; a cancel is not.

The model name is deliberately **not** an env var: it lives in the UI (`/models`, persisted to
`state.json` — see *Model selection* above). The active phase will eventually follow.
