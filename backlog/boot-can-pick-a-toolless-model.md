# Boot can pick a model that cannot call tools

**Category:** Model behavior

`pickSmallestModel` chooses the boot model by sorting the installed set on disk bytes and taking the
smallest. It does not look at what the model can *do*.

On this machine, with no `~/.local-ai-developer/state.json`, that pick lands on
**`deepseek-coder-v2:16b`**, whose capabilities are `completion,insert` — **no `tools`**.
Every phase in this product is a tool-calling loop: a Worker that cannot call `edit_file` cannot do
anything at all. So the unattended path — no saved state, no model named at boot, which is exactly the
first-run path — can select a model that is structurally incapable of running the product, and nothing
says so until the model fails to emit a tool call and the phase burns its rounds looking confused.

`resolveBootModel` already treats the installed set as the only ground truth, which is the right rule;
the set it filters is simply not filtered enough.

**Re-measured on the live daemon (Ollama 0.33.2), and it is worse than one model.** Three of the nine
models installed here report no `tools` capability:

| model | on disk | native ctx | capabilities |
|---|---|---|---|
| **deepseek-coder-v2:16b** | 8.91 GB | 163 840 | `completion, insert` — **no tools**, and the smallest thing installed |
| **deepseek-r1:14b** | 8.99 GB | 131 072 | `completion, thinking` — **no tools** |
| qwen2.5-coder:14b | 8.99 GB | 32 768 | `completion, tools, insert` |
| **codestral:22b** | 12.57 GB | 32 768 | `completion, insert` — **no tools** |
| gpt-oss:20b | 13.79 GB | 131 072 | `completion, tools, thinking` |
| devstral:24b | 14.33 GB | 131 072 | `completion, tools` |
| qwen3.5:27b | 17.42 GB | 262 144 | `vision, completion, tools, thinking` |
| qwen3-coder:30b | 18.56 GB | 262 144 | `completion, tools` |
| qwen2.5-coder:32b | 19.85 GB | 32 768 | `completion, tools, insert` |

## The shape of a fix — and it is no longer a filter

**`pickSmallestModel` is deleted, not fixed** (#1, #10 — *changed answers*, they replace the earlier
"filter the pick and keep smallest as the tie-break"). Nothing infers a boot model any more. The whole
inference ladder collapses into two cases:

- `state.json` has a usable `activeModel` → **use it**, exactly as today.
- It does not → **show the user every installed model and let them choose.**

That removes the class of bug rather than one instance of it: the reason a benchmark pull could
silently re-point an unattended boot (#1's original subject) was that *something was choosing for the
user*. Now nothing is.

## Decisions (answered — OPEN-QUESTIONS.md #1, #7–#14, #69, #71, #72)

- **`pickSmallestModel` is removed** (#1, #10). A saved `activeModel` wins; otherwise the user picks
  from a list. On a machine with **nothing installed**, print recommendations and the exact command to
  install one — and pull nothing (#1: *nothing is ever pulled without approval*).
- **The saved-but-missing re-pull offer goes away with it** (#71 → #10). There is no pick rule left to
  fall through to, so the "offer to re-pull, then gate what comes back" branch has no reason to exist:
  a missing `activeModel` lands in the same list every other unresolved boot lands in.
- **No tool-capable model installed → boot model-less** (#7). The REPL still comes up, the status line
  reads `no model`, and each turn fails with an actionable line — the machinery already works end to
  end, and it is the only outcome that leaves `/models pull` reachable.
- **The failure line names no model** (#8): "pull a model with tool support". `SUGGESTED_MODEL` is a
  suggestion for an *empty* machine, and it has not itself been verified as tool-capable.
- **A saved `activeModel` that is toolless is refused** (#9), and boot falls through to the list.
- **An absent `capabilities` field fails closed** (#13) — assume incapable. See #72 below for what that
  now obliges the repo to state.
- **`/models list` marks tool support** (#14), and so does the boot chooser — the list is where "why was
  that one skipped" is asked, and it is the only place a `(no tools)` marker appears (#12, as clarified
  by #78 below). Boot scrollback is wiped by the REPL's one-time `clearScreen`, which is why the marker
  has to live on a surface the user can re-open rather than in a line printed once at startup.
- **`/models use <name>` on a toolless model refuses, and offers to delete the model** (#69 — this
  overrides #11c, which was written into the docs on an inference that has now been corrected). The
  full shape: the chooser and `/models list` **show** toolless models, marked; they are **not
  selectable**; attempting to select one prints the reason it is unavailable and asks whether to delete
  it. So a toolless model is visible, explained, and disposable — never silently active.

## The `(no tools)` marker belongs to the list, not the status line (#78)

#12 was read as putting `Model: <name> (no tools)` in the **pinned status line**, which #69's refusal
then made unpaintable — no toolless model can ever be active. That reading was wrong: #12 was about the
**model list** all along, and **#69 stands**.

So there is exactly one place a `(no tools)` marker appears, and it is the same place in both surfaces
that show models — `/models list` and the boot chooser. Nothing paints it in the pinned rows, and the
status line needs no new field.

## The "too heavy" tag, and the boot probe behind it

Inherited from the `OLLAMA_NUM_CTX` task (OPEN-QUESTIONS.md §F), which closed with the rule that
motivates this — now stated in [docs/product.md](../docs/product.md), *What it optimizes for*:

> Spill is acceptable while the **weights** stay resident and only **KV cache** offloads.

Weights on the CPU means every token of every layer crosses the bus; KV cache on the CPU costs only the
attention reads. So the list carries a **second** marker beside `(no tools)` — a **too heavy** tag — and
unlike the capability gate it **marks without refusing** (#96a): a slow model is the user's choice to
make, an incapable one is not.

**Measured on this box**, each model loaded at `num_ctx` 16 384 with `/api/ps` read directly:

| model | weights (on disk) | in VRAM | spilled | weights resident? |
|---|---|---|---|---|
| qwen2.5-coder:14b | 8.99 GB | 10.49 GB | 1.93 GB | **yes** — the spill is all KV cache |
| codestral:22b | 12.57 GB | 10.70 GB | 5.89 GB | no — ~1.9 GB of *weights* on the CPU |
| gpt-oss:20b | 13.79 GB | 10.20 GB | 3.87 GB | no |
| qwen3-coder:30b | 18.56 GB | 10.61 GB | 9.82 GB | no |
| qwen2.5-coder:32b | 19.85 GB | 10.35 GB | 14.13 GB | no |

The VRAM ceiling is **10.2–10.7 GB** on this 12 GB card — a ceiling rather than a coincidence, since
five models of very different sizes all stop within half a gigabyte of it. Combined with the capability
gate, **`qwen2.5-coder:14b` is the only installed model that can run this product**: three of the nine
have no `tools`, and six cannot keep their weights resident. (`qwen3.5:27b` is the one model not probed,
and it is larger than two that already fail.)

### How the machine is probed (#100c)

**By loading each installed model once at boot**, never by a hardcoded figure and never by a vendor CLI.
`/api/ps` reports `size` and `size_vram`, and `size_vram < size` **is** the spill — measured, not
predicted, and portable to any card. Ollama offers no way to ask the machine its capacity: `/api/status`
carries no GPU data, `/api/ps` is empty until something loads, and
`/api/experimental/model-recommendations` is a curated list with generic `vram_bytes` hints.

Cold-load cost was measured at **11.4 s** (codestral:22b), **16.4 s** (qwen3-coder:30b) and **26.0 s**
(gpt-oss:20b) — ≈18 s each, so **≈2.7 minutes for nine models**, once.

**It cannot run while a session is live.** Probing *is* loading, so a background probe would evict the
session model mid-turn — the one thing `docs/product.md`'s no-parallelism rule exists to prevent.

**The verdict depends on `num_ctx` as well as the model** (#96), because the KV cache is the part that
grows with the ceiling. The same model is "too heavy" at one ceiling and fine at another.

### The probe cache (#103)

> *"Cache it in a different file, so if the user changes a driver or the GPU, it can safely delete and
> regenerate all values. Also, we dont need to invalidate, we can start mapping values for different
> num_ctx's as if the user changes it back to a known value, we dont need to reprobe."*

So: **its own file**, not `state.json` — deleting it is the reset gesture, and it must be safe to delete
at any time because nothing in the repo can detect a driver or GPU change. It lives beside `state.json`
in the user's home directory, since this is a property of the **machine**, not of a project.

And it **accumulates rather than invalidates**: a growing map of `(model, num_ctx) → verdict`. Changing
`OLLAMA_NUM_CTX` to a new value probes at that ceiling and keeps the old rows; changing it back costs
nothing. The file only ever grows, and only ever by entries that were true when measured.

**One implementation point makes "no invalidation" correct rather than merely convenient: key the model
half on its `digest`, not its name.** A tag like `:latest` can be re-pulled as different bytes, and a
name-keyed row would then describe a model that no longer exists — the one stale case an
invalidation-free cache could not otherwise survive. Keyed on the digest, a re-pull is simply a key that
has never been seen, so it re-probes on its own. `/api/tags` already returns `digest` in the same call
that returns `capabilities` and `size`, so this costs nothing.

**Still to decide when this ships:** whether a newly pulled model is probed immediately after
`/models pull` — the moment the user is already waiting — or at the next boot. Not asked; the smaller
question, and either is defensible.

## Two sub-questions this file carried are now answered by measurement, not by decision

**Capabilities cost exactly one round trip, and `/api/tags` is the right endpoint.** The file's earlier
open question — *is the capability cached or re-read, given that a per-model `/api/show` at boot would
be N round-trips rather than one?* — is moot. Probed against the live daemon: **`/api/tags` returns
`capabilities` per model**, alongside a `details.context_length`, in a single call. No `/api/show`
fan-out, nothing to cache, and `listModels` already makes exactly that call — it simply projects the
field away today.

**But the pinned `ollama` package cannot see the field.** `node_modules/ollama` is **0.5.18**, whose
`ModelResponse` declares `name · modified_at · model · size · digest · details · expires_at ·
size_vram` and **no `capabilities`**; the field is declared only on `ShowResponse`. So the work needs
either a package bump or a narrowed read of the raw response — and the constitution forbids reaching
for `any` to paper over it. Deciding which is implementation, not product, and is left to the
shipping commit.

## #72 — the minimum Ollama version, researched

#13's fail-closed rule turns "your daemon is too old to report capabilities" into "no model on this
machine can run this product", so the floor has to be stated. It was researched rather than guessed,
and **the two endpoints have different floors**:

| field | endpoint | first release | date |
|---|---|---|---|
| `capabilities` | `/api/show` | **v0.6.4** | 2025-04-02 |
| `capabilities` | `/api/tags` | **v0.9.1** | 2025-06-09 |

(`ollama/ollama` PR #10066 merged 2025-04-01, first contained in the `v0.6.4` tag; PR #10174 *"Server:
Enhance API/tag with Capability Information"* merged 2025-06-04, first contained in `v0.9.1`.)

Since the design above reads `/api/tags`, **the floor is Ollama ≥ 0.9.1**. This box runs **0.33.2**,
far past it. The number is recorded in [README-INCONSISTENCIES.md](../README-INCONSISTENCIES.md) for
the user to fold into `README.md`'s Requirements by hand (#72, #21).

**A boot-time version check ships too** (#79b). Stating the floor is not enough on its own: without a
check, a daemon older than 0.9.1 makes every installed model fail the capability gate, and the user is
told "no model on this machine supports tools" when the truth is "your daemon cannot say". The check
turns a misleading diagnosis into an accurate one.

It sits beside the Node check task C is adding, and the two should read as one family — same shape, same
place in the boot sequence, both naming what to do rather than only what is wrong. Unlike the Node check
this one cannot live in `scripts/run.mjs`, because the daemon version is only knowable by asking it:
`/api/version` is a single unauthenticated GET, and boot already fails hard on an unreachable daemon, so
it belongs next to that existing check.
