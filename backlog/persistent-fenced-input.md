# Persistent, fenced input during a turn

**Category:** Terminal UI / rendering

While the model is thinking/streaming, the input line and its fencing rule must stay on screen —
today the top rule vanishes during a turn. Pairs with message queueing and the chrome mockup below
(which shows the input present while a turn runs).

```
<while a turn runs: spinner + activity line>
──────────────────────────────────────────────
›
──────────────────────────────────────────────
Phase: Discovery | Ctx: 0%
Model: qwen2.5-coder:14b | Project: morse-coder
```
