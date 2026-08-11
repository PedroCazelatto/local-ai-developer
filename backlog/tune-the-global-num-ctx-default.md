# Is 16 384 the right `OLLAMA_NUM_CTX` for this box?

**Category:** Memory / context

Held out of the per-window `num_ctx` task on purpose — that one tuned *which window gets what*, and this
asks whether the number they are all measured against is right at all. Recorded here rather than in that
file because a task file is deleted in the commit that ships it, and this is a decision for later. That
task has now shipped: every **window** role runs at `OLLAMA_NUM_CTX`, so this number is still the one that
governs the Worker, the Reviewer, Retro, sub-agents and the interactive phases alike.

## The measurement

`qwen2.5-coder:14b` on the RTX 3060 12 GB, `size_vram` and `size` read from Ollama's `/api/ps`:

| `num_ctx` | in VRAM | total | offloaded to CPU |
|---|---|---|---|
| 4 096 | 9.47 GB | 9.47 GB | none |
| 8 192 | 10.28 GB | 10.28 GB | none |
| **16 384 — today's default** | 10.49 GB | 12.42 GB | **1.93 GB** |
| 24 576 | 10.62 GB | 14.08 GB | 3.45 GB |
| 32 768 | 10.45 GB | 15.75 GB | 5.30 GB |

Two things follow. **Nothing can go up** — the current default already spills, and raising any window's
ceiling deepens it. And **16 384 → 8 192 is the difference between hybrid and fully-resident inference**,
which is potentially a larger effect than every per-window saving combined.

A second measurement bears on any change here: **altering `num_ctx` on the same model rebuilds the runner.**
Same ceiling twice costs ~90 ms; a changed ceiling costs **~3.3 s**, with `/api/ps` showing
`context_length` and `size_vram` both moving. So ceilings should vary by a lot and seldom, never finely and
often.

## What makes this a decision rather than a tuning knob

`contexts.num_ctx` stamps the value every phase context was written under, and every `/resume` listing
filters on it. **Changing `OLLAMA_NUM_CTX` hides every existing context in every project's `memory.db`** —
nothing is deleted, nothing is reachable. That is the same rule the per-window work pins itself to, and it
cuts both ways: the per-window task's own complaint that *"'I want more room for this task' costs the user
every context they have"* is exactly what a global retune costs too.

It also interacts with the fixed overhead. The per-turn floor — system prompt plus the rendered tool
schemas — measures **5 432 tokens for the Worker and 7 128 for Discovery**, so halving the ceiling to 8 192
leaves the Worker ~2.8 k of working room and Discovery ~1 k. That is very likely too little, which is why
this is a measurement question and not an obvious win.

## What to do before deciding

Benchmark **generation throughput** at 8 192 versus 16 384 on the real session model — tokens/second from
`eval_count` and `eval_duration`, not wall clock — to find what the 1.93 GB spill actually costs per turn.
The VRAM table says what is resident; it does not say what hybrid inference costs, and that number is the
whole decision.

## Open decisions

- **Is the throughput cost of the spill worth the window room?** Nothing else can be decided first.
- **If the default changes, what happens to existing contexts?** Accept the one-time hide, migrate the
  column, or make `/resume` show contexts written under a different ceiling with a warning.
- **Does this become per-model rather than global?** A 32b and a 3b do not want the same ceiling on the same
  card, and `OLLAMA_NUM_CTX` is one number for whatever is loaded.
