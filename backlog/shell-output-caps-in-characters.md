# The shell tools' output caps are still characters, and one can overrun the window

**Category:** Memory / context

Backlog item 7 derived every model-facing budget from `OLLAMA_NUM_CTX` and moved them to estimated
tokens (`src/core/session/budget-fractions.ts`). **Two model-facing caps were missing from that task's
inventory** and were left as they were, by the user's decision, to be filed here rather than converted
in passing:

| constant | value | file | what it bounds |
|---|---|---|---|
| `DEFAULT_OUTPUT_LIMIT` | 20 000 chars | `src/tools/truncate.ts` | `execute_command`'s combined `STDOUT: … STDERR: …` result |
| `RUN_OUTPUT_LIMIT` | 50 000 chars | `src/tools/run-in-project.ts` | `run_in_project`'s stdout **and** its stderr, **each** |

Both are applied with `truncateHeadTail` (characters), not `truncateHeadTailToTokens`.

## Why it matters

At the estimator's four characters a token, `DEFAULT_OUTPUT_LIMIT` is ~5 000 tokens — almost a third of
the default 16 384 window for one tool result. `RUN_OUTPUT_LIMIT` is worse: it is **per stream**, so a
noisy `npm i` that fills both returns ~25 000 tokens, **more than the whole window**. Ollama then drops the
front of the history silently, which is the failure every other budget in the repo exists to prevent.
Neither moves when `OLLAMA_NUM_CTX` does.

The build path in `run-in-project.ts` caps a combined `STDOUT:`/`STDERR:` string and a lone `stderr` with
the same constant, so there are four call sites to that one number, not one.

## What to decide

- **The fractions.** Item 7's rule was to preserve today's effective budget; here that would preserve a
  budget larger than the window, so the rule cannot apply as-is. Propose fractions and have the user
  confirm them, as #99 did.
- **Whether `run_in_project`'s cap stays per stream** or becomes one budget split between stdout and
  stderr.
- **Whether `truncateHeadTail` (characters) survives at all** once neither tool uses it.
  `TEST_RUN_CAPTURE` in `worker-window.ts` already re-cuts a `run_in_project` result to its own token
  budget, so it is unaffected either way.

When this ships, update the closing sentence of the `OLLAMA_NUM_CTX` entry in `docs/cli.md`, which names
these two caps as still in characters, and the *What is deliberately NOT here* note at the top of
`budget-fractions.ts`.
