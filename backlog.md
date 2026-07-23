# Backlog

Pending tasks and changes for the orchestrator. Check an item off when it ships.

## Terminal UI / rendering

### Input behavior

The chrome mockup the persistent-input work targets (the input stays present while a turn runs):

```
<while a turn runs: spinner + activity line>
──────────────────────────────────────────────
›
──────────────────────────────────────────────
Phase: Discovery | Ctx: 0%
Model: qwen2.5-coder:14b | Project: morse-coder
```

- [ ] **Persistent, fenced input during a turn.** While the model is thinking/streaming, the input
  line and its fencing rule must stay on screen — today the top rule vanishes during a turn. Pairs
  with the queue below and the chrome mockup (which shows the input present while a turn runs). (feedback)
- [ ] **Queue messages sent while the model is thinking.** Let the user submit more messages during a
  turn; queue them and run them in order after the response finishes. **While a message is queued,
  pressing ↑ (arrow up) un-queues the most recent one and refills the input for editing.** (feedback)
- [ ] **Shift+Enter inserts a newline.** Let the user compose multi-line input — Shift+Enter adds a
  line break instead of submitting the message. (feedback)

### Output rendering

- [ ] **Keyword-driven rendering — not markdown by default.** Today every model line is rendered as
  markdown. Change it so plain prose stays plain (still word-wrapped at spaces), and rich rendering is
  **opt-in via fenced keywords**: a ` ```markdown ` block is rendered as markdown, and a new ` ```code `
  (with an optional language) block is verbatim code (unwrapped). Two sides: the phase instructions
  under [rules/](rules/) must tell the model to emit these fences, and `render-markdown-line.ts` /
  `create-markdown-stream.ts` must switch rendering mode on them (word-wrap already skips ``` fences).
  (feedback)

## Model behavior / instructions

- [ ] **Let the model use internal commands.** Give the model the ability to invoke internal
  commands itself (e.g. `/swap`).
- [ ] **Per-phase commits.** Give every phase the ability to commit its changes. A **subagent** must
  write the commit messages. Each commit must be **as small as possible without breaking the
  application**.
- [ ] **Sharpen the model's thinking via model-to-model dialogue.** Add prompts/mechanism for one
  model context to talk to another and discuss ideas — a deliberation/debate loop (e.g. a second
  spawned window that challenges and refines the first's reasoning) so the model pressure-tests an
  idea before committing to an answer. (One Ollama model, two context windows — per the core mental
  model.)
