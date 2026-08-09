# Steer a turn that is already running

**Category:** Terminal UX

## Decide whether to build this at all

This is the first question, not an implementation note. It may be the wrong feature for this product.

**Against.** `docs/product.md` states the way to scale is "start a batch and let it run unattended
(e.g. overnight)". An unattended batch has nobody there to steer it. Steering serves someone sitting and
watching a turn — which is the mode this project deprioritized on purpose — and the message queue already
handles the attended case adequately, with `⏳ queued:` announced in the scrollback and `↑` taking the last
one back.

**For.** A local 14–32b model heading down a wrong path costs minutes per turn, and a batch is that
multiplied by tasks × rounds × two windows. The cheapest correction is a sentence delivered at the next tool
boundary rather than a cancel-and-restart that discards the turn.

Either answer is fine and should be recorded — if the answer is no, delete this file and say so in
`docs/product.md` so the question does not get re-opened.

**Cancelling has shipped**, which was the prerequisite: Ctrl+C stops the turn in flight, the exchange
branches off the phase's history so the message can be rewritten, and `/stop` · `/stop round` wind a batch
down (see the *Stopping a turn* section of `docs/cli.md`). That was the safety net making steering optional
— without it, steering would have been the only way out of a bad turn, which is the wrong reason to build
it. The question is now genuinely just "is steering worth it on its own merits".

## If the answer is yes

Today a message typed during a turn is queued and runs only once the turn has finished
(`src/core/ui/message-queue.ts`). Injecting it at the next tool-call boundary is the precise version, and the
turn loop already has that seam: `src/core/session/turn-loop.ts` dispatches tool calls in a loop, and the
point between finishing one call and starting the next turn is where a `user` message can be appended without
splitting the `tool_calls` / `tool` pair.

That last constraint is the same hazard [switch-phase-tool.md](switch-phase-tool.md) documents: a `tool`
message with no preceding `tool_calls` message breaks the chat template on replay. Injection has to land
after every result for the current assistant message is stored, never between them.

## Open decisions

- **Whether an injected message is visually distinct from a queued one.** The scrollback currently says
  `⏳ queued:`; a message that lands mid-turn is a different event and should read as one.
- **Whether steering is available during a batch at all**, or only during an interactive phase. A batch is
  the unattended case by definition, and a steer aimed at task 3 that arrives during task 4 is worse than no
  steer.
- **What the model is told about it.** An injected message arriving between tool calls is unusual enough that
  the phase prompts may need to say it can happen, or the model will treat it as a malformed history.
