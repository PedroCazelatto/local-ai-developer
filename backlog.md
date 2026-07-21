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
- [ ] **Autocomplete: single option list.** When autocomplete shows its options, print the option
  list **only once**, and once an option is selected remove that list from the terminal scrollback.
- [x] **Inline free-text answer in `ask_user`.** For a question's "user answer" (free-text) option,
  selecting it and starting to type should immediately begin writing the user's message into that
  option — no separate prompt step.

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
