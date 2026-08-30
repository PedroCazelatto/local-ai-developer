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

## Answered: the number stays at 16 384 (#68b)

The benchmark ran on both models, every figure read from Ollama's own response fields (fixed
4 548-token prompt, `num_predict` 128, temp 0, seed 42, KV prefix cache busted per call, A/B/A/B
blocks, warm-up discarded). **Full results are in [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) §F.** The
three lines that decided it:

- **16 384 costs 29.1 % of generation throughput on the 14b** (25.09 → 17.79 tok/s) and only 6.8 % on
  the 32b.
- **12 288 is not fully resident either** — 0.92 GB still spills. This file's original premise, that
  the choice was resident vs. hybrid, was wrong. The residency cliff sits *below* 12 288.
- **The room is worth more than the speed.** 16 384 leaves the Worker 10 952 tokens of working room
  against 12 288's 6 856, and Discovery 9 256 against 5 160.

*"As generation speed is nowhere near a big problem, lets keep 16k tokens."* (#68) — which is the same
principle now recorded for the whole project: **precision and accuracy over time taken**
([OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) meta I). Nothing migrates, no context is hidden, and
[#35](../OPEN-QUESTIONS.md)'s migration question is moot on this answer (it was answered **a**, accept
the hide, and that answer stands if the number ever does move).

Two findings worth keeping past this file:

- **8 192 is disproved a third way.** At 8 192 the summarization threshold (0.75 × 8 192 = 6 144) falls
  *below* Breakdown's 7 283-token fixed overhead, so both failsafes would fire on turn one.
- **The ceiling-change runner rebuild is ~16–18 s on the 32b**, not the ~3.3 s recorded for the 14b. A
  bounded one-shot's down-and-back therefore costs **~33 s on a 32b**, which bears directly on whether
  the bounded 8 192 lane is a net win on large models at all — see #53 in
  [surface-matching-standards.md](surface-matching-standards.md) and the new
  [derive-constants-from-one-ceiling.md](derive-constants-from-one-ceiling.md).

## Per-model ceilings: deferred (#37a)

One global number is demonstrably wrong for one of the two models — 29.1 % against 6.8 % — but it is
deferred anyway, and the reason is `contexts.num_ctx`: a ceiling that follows `/models use` changes
**mid-session**, while a context is stamped **once at creation**. Per-model ceilings mean the stamping
design changes too, which is a larger piece of work than the saving justifies. **The number this repo
keeps is right for the 32b and expensive on the 14b** — recorded here as #37a requires.

## Spun out of this file

- **[resume-across-num-ctx-changes.md](resume-across-num-ctx-changes.md)** (#36a) — relaxing
  `contexts.num_ctx = ?` to `<= ?` ships as its **own fix**, independent of whether the number ever
  moves. Strict equality already hides contexts that would replay perfectly safely into a larger
  window, which is a standalone defect.
- **`OLLAMA_KV_CACHE_TYPE` is folded into the residency rule, not filed separately** (#85c). Under
  #84c it is the one knob that acts directly on the thing the rule cares about: a q8_0 KV cache halves
  the *cache* spill without touching the weights, so it makes the rule easier to satisfy at any ceiling.
  It belongs in the same note as the rule rather than in a file of its own.

## The residency rule, stated (#84c)

The collision between #57 (*no model can be run on CPU*) and #68 (*keep 16 384*, which spills 1.93 GB by
construction) is resolved by naming what "runs on CPU" actually forbids:

> **Spill is acceptable while the weights stay resident and only KV cache offloads.**

That is a rule with teeth, and it is what #57 was protecting: weights on the CPU means every token of
every layer crosses the bus, while KV cache on the CPU costs only the attention reads. 16 384 satisfies
it on the 14b — 10.49 GB in VRAM against ~9 GB of weights, so the 1.93 GB that spills is cache.

**It also disqualifies most of the models on this box, which is worth knowing before the boot chooser
ships.** Ollama caps VRAM use on this 12 GB card at ~10.4 GB (measured: `size_vram` was 10.49 GB for the
14b and 10.35 GB for the 32b — the ceiling, not a coincidence). A model whose weights exceed that cannot
satisfy the rule at **any** `num_ctx`:

| model | on disk ≈ weights | weights resident? | tools? |
|---|---|---|---|
| qwen2.5-coder:14b | 8.99 GB | **yes** | **yes** |
| deepseek-r1:14b | 8.99 GB | yes | no |
| deepseek-coder-v2:16b | 8.91 GB | yes | no |
| codestral:22b | 12.57 GB | no | no |
| gpt-oss:20b | 13.79 GB | no | yes |
| devstral:24b | 14.33 GB | no | yes |
| qwen3.5:27b | 17.42 GB | no | yes |
| qwen3-coder:30b | 18.56 GB | no | yes |
| qwen2.5-coder:32b | 19.85 GB | no | yes |

**`qwen2.5-coder:14b` is the only installed model that satisfies both gates**, and this is now
measured rather than inferred. Each model was loaded at `num_ctx` 16 384 and `/api/ps` read directly:

| model | weights (on disk) | in VRAM | spilled | weights resident? |
|---|---|---|---|---|
| qwen2.5-coder:14b | 8.99 GB | 10.49 GB | 1.93 GB | **yes** — the spill is all KV cache |
| codestral:22b | 12.57 GB | **10.70 GB** | 5.89 GB | no — ~1.9 GB of *weights* on the CPU |
| gpt-oss:20b | 13.79 GB | **10.20 GB** | 3.87 GB | no |
| qwen3-coder:30b | 18.56 GB | **10.61 GB** | 9.82 GB | no |
| qwen2.5-coder:32b | 19.85 GB | **10.35 GB** | 14.13 GB | no |

The VRAM ceiling is confirmed at **10.2–10.7 GB** on this 12 GB card, and it is a ceiling rather than a
coincidence — five models of wildly different sizes all stop within half a gigabyte of the same figure.
`codestral:22b` was the borderline case the earlier note only inferred; it fails. `qwen3.5:27b` (17.42
GB) is the one model still un-probed, and it is larger than two that already fail.

**The list marks it; nothing refuses it** (#96a). A "too heavy" tag beside a model, exactly like the
`(no tools)` marker, and the user may still choose it — a slow model is a legitimate choice, an
incapable one is not.

**The VRAM figure is never hardcoded** (#96): *"we must always probe the machine to know."* Two further
points from that answer shape the tag:

- **It depends on both variables** — the model's weights *and* the configured `num_ctx`, since the KV
  cache grows with the ceiling. The same model is "too heavy" at one ceiling and fine at another, so
  the tag is recomputed when either changes, not stamped once.
- **There is an exact after-the-fact check that needs no VRAM figure at all.** `/api/ps` reports both
  `size` and `size_vram` for a loaded model: `size_vram < size` *is* the spill, measured rather than
  predicted. So the tag is a prediction shown before loading, and the loaded state can always be
  verified — and corrected — against the daemon.

**The machine is probed by loading each installed model once at boot** (#100c). No vendor CLI, no
hardcoded figure, and nothing to be wrong about on another card: `/api/ps` reports `size` and
`size_vram` for whatever is loaded, and `size_vram < size` **is** the spill — measured, not predicted.
It is the only option that is both exact and portable, since Ollama exposes no way to ask the machine
its capacity (`/api/status` carries no GPU data, `/api/ps` is empty until something loads, and
`/api/experimental/model-recommendations` is a curated list with generic `vram_bytes` hints).

**It costs less than the option feared.** Load time was measured on the three models probed above:

| model | cold load |
|---|---|
| codestral:22b | 11.4 s |
| qwen3-coder:30b | 16.4 s |
| gpt-oss:20b | 26.0 s |

≈18 s each, so **≈2.7 minutes for all nine models on this box**, once. The option was written as
"costs minutes on a machine with nine models"; that is accurate and it is a one-time boot cost.

**Two constraints on when it runs.** It cannot run in the background while a session is live — probing
*is* loading, so it would evict the session model mid-turn, which is the one thing `docs/product.md`'s
no-parallelism rule exists to prevent. And the result depends on `num_ctx` as well as the model (#96),
so it is keyed on both. What caches it and what invalidates it is
[OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) **#103**.

**This file is finished — every question in section F is answered.** It is deleted and its line in
[backlog/README.md](README.md) ticked in the commit that carries the residency rule into
[docs/product.md](../docs/product.md). That doc edit is **review-gated**, so it is made in the working
tree and handed over; the deletion rides along once it is approved.
