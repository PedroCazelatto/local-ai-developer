# Backlog

Pending tasks and changes for the orchestrator. Check an item off when it ships.

## Terminal UI / rendering

- [x] **No divider between messages; style user messages.** Stop drawing a rule between
  messages — separate consecutive messages with a single blank line instead. Render **user**
  messages with a light-gray background. Keep a horizontal rule directly **above and below the
  live input line** (the area where the user is currently typing). *(Chosen layout: clean history —
  gray user messages with no rules, blank-line separated; the live input is fenced by a transient
  top rule and a pinned rule row above the status bar.)*
- [x] **Remove the phase-name prefix** (e.g. `discovery ›`) from the start of every assistant
  response message.
- [x] **Autocomplete: single option list.** When autocomplete shows its options, print the option
  list **only once**, and once an option is selected remove that list from the terminal scrollback.
  *(Chosen: type-to-complete. Tab extends the shared prefix and renders any remaining choices as a
  transient list on the pinned footer row — shown once, cleared on the next keystroke, never in
  scrollback.)*
- [x] **Inline free-text answer in `ask_user`.** For a question's "user answer" (free-text) option,
  selecting it and starting to type should immediately begin writing the user's message into that
  option — no separate prompt step.

### Message rendering fixes

- [ ] **Full-width gray user message.** The light-gray background must span the **entire terminal
  width** (a full-width bar), not just the typed text. (feedback)
- [ ] **A full-width rule still leaks between messages.** History must be gray messages + blank lines
  only — no rules — but a rule still shows between messages: the live-input top rule is not being
  fully cleared on submit. Fix the erase (or fold into the persistent-input redesign below, which
  removes the erase-on-submit dance entirely). (feedback)

### Input chrome redesign

The boot banner and the pinned bottom rows get reworked into the mockup below. The four items share
the three-row pinned budget (rule + **two** status lines, no footer row) and the activity-field move,
so treat them as **one coordinated change** — shipping them piecemeal breaks the row accounting. Target:

```
<while a turn runs: spinner + activity line>
──────────────────────────────────────────────
›
──────────────────────────────────────────────
Phase: Discovery | Ctx: 0%
Model: qwen2.5-coder:14b | Project: morse-coder
```

- [ ] **Drop the boot banner.** Remove the one-time top banner `Local AI Developer  ·  /swap <phase>  ·
  /exit` (`BANNER` / `renderer.header()` in [renderer.ts](src/core/ui/renderer.ts), called from
  `runRepl`). The mockup has no banner; the live session context already lives in the pinned status
  bar. *(The model-less `No model selected…` notice is separate — keep it.)*
- [ ] **Two-line status bar, new format.** Replace the single pinned status line with **two** pinned
  lines below the input rule (see mockup):
  - Line 1: `Phase: <Name> | Ctx: N%` — phase name **Capitalized** (`Discovery`, not `discovery`),
    still painted in the phase's theme color.
  - Line 2: `Model: <model> | Project: <project>`.
  - **`Ctx: N%` where N = round(`activePhaseTokenTotal` ÷ `num_ctx` × 100)** — the active phase's
    context-window fill against the `num_ctx` ceiling (still an EXACT count, never an estimate —
    constitution). **Decided: never render `?%`** — when the count is null/unreported, show **`0%`**.
    This replaces the old `?/16384 tok` and the compact `Σ` per-phase field.
  - `|` separators (not `·`). RESERVED stays **3** (rule + status line 1 + status line 2): the old
    footer row is reused as status line 2, and the pinned rule stays directly under the live input.
- [ ] **Remove the footer hint row + the Tab / Shift+Tab machinery.** The pinned `Tab: complete ·
  Shift+Tab: cycle phase · /swap <phase>: jump · /help: commands` row is gone (its row becomes status
  line 2). **Decided: also rip out the completion and phase-cycle features themselves — they weren't
  working:** the `keypress` handler, [complete-action.ts](src/interface/complete-action.ts) +
  [complete-line.ts](src/interface/complete-line.ts), the no-op `completer`,
  `showCompletions`/`restoreFooter`/`completionsShown`, and `isTab`/`isBackTab`/`cyclePhase` in
  [repl.ts](src/interface/repl.ts). Phase switching stays via `/swap`; `/help` still lists commands.
- [ ] **Transient activity line above the input.** Move the live activity indicator OUT of the status
  line into a transient spinner line rendered **above the top input rule** while a turn runs. **Decided:
  it carries BOTH** `thinking (X.Xs)` **and** `running <tool> (X.Xs)` — the status line no longer shows
  any activity field, so `statusActivity` feeds this line instead. It repaints on the existing
  `STATUS_TICK_MS` ticker and collapses when the turn ends, keeping scrollback append-only.
  - **Drop the `X.Xs since last tool` variant** (feedback): the timer only ever shows thinking/tool
    elapsed time, never time-since-the-last-tool-call.

### Input behavior

- [ ] **Persistent, fenced input during a turn.** While the model is thinking/streaming, the input
  line and its fencing rule must stay on screen — today the top rule vanishes during a turn. Pairs
  with the queue below and the chrome mockup (which shows the input present while a turn runs). (feedback)
- [ ] **Queue messages sent while the model is thinking.** Let the user submit more messages during a
  turn; queue them and run them in order after the response finishes. **While a message is queued,
  pressing ↑ (arrow up) un-queues the most recent one and refills the input for editing.** (feedback)
- [ ] **Shift+Enter inserts a newline.** Let the user compose multi-line input — Shift+Enter adds a
  line break instead of submitting the message. (feedback)

## Model behavior / instructions

- [ ] **Let the model use internal commands.** Give the model the ability to invoke internal
  commands itself (e.g. `/swap`).
- [ ] **Don't print file contents in chat.** Instruct the model to output only the file **path**
  (so it can be read later), never the file's full contents.
- [ ] **Per-phase commits.** Give every phase the ability to commit its changes. A **subagent** must
  write the commit messages. Each commit must be **as small as possible without breaking the
  application**.
- [ ] **Sharpen the model's thinking via model-to-model dialogue.** Add prompts/mechanism for one
  model context to talk to another and discuss ideas — a deliberation/debate loop (e.g. a second
  spawned window that challenges and refines the first's reasoning) so the model pressure-tests an
  idea before committing to an answer. (One Ollama model, two context windows — per the core mental
  model.)
- [ ] **Never render questions or menus as text — use `ask_user`.** The model sometimes prints a
  question with a fake `[ ] Yes / [ ] No` checkbox list and `───` rules in prose instead of calling
  `ask_user`. Strengthen the phase instructions (and/or system prompt) so every question to the user
  goes through `ask_user`, and the model never draws its own horizontal rules or checkbox menus.
  (feedback)
