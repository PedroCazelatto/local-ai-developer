# Two ways `core/llm` corrupts the reply the user reads

**Category:** Terminal UX

Two defects found by backlog item 2's `core/llm` test pass. They are filed together because they share a
directory, a reviewer, and a **symptom class**: in both, the model's output is correct and **what reaches
the user's screen is not**. Both are pinned as *current* behaviour by new tests; **neither is fixed.**

## 1. A reply that ends in a fenced code block loses its closing fence

`src/core/llm/stream-filter.ts`. `flush()` returns held text only in `prose` and `fence_close` modes. A
closing ``` sits in `fence_open`, so it is dropped. Driven directly:

| input | output | |
|---|---|---|
| `` ```ts\nconst a = 1;\n``` `` | `` ```ts\nconst a = 1;\n `` | **lossy** |
| `` ```ts\nconst a = 1;\n```\n `` | `` ```ts\nconst a = 1;\n `` | **lossy** — trailing newline too |
| `` ```ts\n `` | *(empty)* | **lossy** — the whole opener |
| `` inline `code` `` | `` inline `code `` | **lossy** — a single closing tick |
| `` ```ts\nconst a = 1;\n```\ndone `` | unchanged | lossless |

**The shape is the worst one a bug can have: it is lossless only when prose FOLLOWS the block.** The
closing fence is re-read as a new opener and aborted back into prose, which is what saves that case. So
**the ordinary case fails and the unusual one passes** — which is exactly the distribution that keeps a
defect alive, because the example anyone reaches for first is the one that works.

It is reachable by instruction, not by accident: `system-prompt.ts` tells the model to use *"a fenced
block (with its language tag) for code and commands"*. A reply that ends with the code it just wrote —
the common shape for "here is the fix" — shows the user an unterminated code block.

## 2. `repairDecode` counts `consumed` in code points; every caller slices in code units

`src/core/llm/repair-decode.ts` iterates `for (const ch of text)`, so **each astral character undercounts
by one.** Every caller slices with `String.prototype.slice`, which counts UTF-16 code units. Driven end
to end:

```
content : 'a {"name":"x","arguments":{"msg":"hi 😀"}} b'
consumed : 39        (the JSON is 40 code units)
cleaned  : 'a } b'   <- a stray closing brace, left in the reply
```

**The tool call itself is recovered correctly.** It is the *span* that misaligns, so the debris lands in
exactly the place the user reads. **One emoji is enough**, and a model writing a commit message, a log
line or README content is an ordinary way to produce one.

Record the sentence that hides it: the JSDoc says `consumed` *"counts characters of the original text"* —
precisely ambiguous enough to read as correct, since "character" is the word that means neither thing.

## Two conditions on both, same as items 22–24

- **The tests already assert the current, wrong behaviour**, deliberately. Fixing either means changing
  its test. That is the mechanism working.
- **Neither may ride along in a sweep commit.** And this one is easy: **`core/llm` closed at `602f62f`**,
  so there is no refactor in flight to hide behind. A fix now is its own reviewable commit against a
  settled directory.

## A note that is NOT a defect

`expandOverFence`'s guard `opener.index + opener[0].length !== start` is **unreachable**. `FENCE_BEFORE`
is `$`-anchored, and JS `$` without `/m` matches only end-of-input, so a match against
`content.slice(0, start)` always ends at `start`. It is harmless defensive code and is recorded **only**
so nobody reads it as covering a case it cannot — **do not promote this to a task.**
