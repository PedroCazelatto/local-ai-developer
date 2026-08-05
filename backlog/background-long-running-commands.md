# Background a long-running command instead of blocking the window

**Category:** Execution loop

## Decide whether this is allowed before building it

`docs/product.md` lists **no parallelism** as a non-goal. The stated reasoning is about VRAM and concurrent
model windows, which does not obviously cover a shell command running in a container while one window thinks
— but it may be intended to cover both, and that is not something to assume.

**Settle this first.** If the non-goal covers shell commands too, delete this file and record the reasoning in
`docs/product.md` so the question does not get re-opened. Nothing below is worth designing until the answer
is known.

## If it is allowed

`run_in_project` blocks with a 120-second default and the container is killed at the cap. A real `npm install`
or a full test suite exceeds that routinely. The model can raise `timeout_s`, but the window still sits idle
waiting — and on a 3060 that idle window is holding VRAM the whole time.

Backgrounding a command and polling it would let a Worker start a slow suite and keep reading code while it
runs. The shape:

- A start call that returns a handle immediately, and a poll call that returns status plus whatever output has
  accumulated.
- The same head+tail truncation the blocking version already applies, so a chatty build does not arrive as one
  enormous tool result.
- A hard reap at the end of the task, so a backgrounded process never outlives the window that started it. A
  Reviewer must not inherit a running container from the Worker.

## Open decisions

- **What the model is told when it polls too early.** "Still running, 40s elapsed" is a tool result that costs
  window every time it is called, and a small model will poll in a tight loop unless the prompt or the tool
  makes waiting the obvious move.
- **Whether the turn can end with a command still running.** If it can, the result has to be delivered into a
  later turn, which means the window's history gains a message the model did not ask for at that point.
- **Whether this subsumes the timeout.** With backgrounding available, `timeout_s` on the blocking path could
  stay as-is, shrink (because anything slow should be backgrounded), or go away.
