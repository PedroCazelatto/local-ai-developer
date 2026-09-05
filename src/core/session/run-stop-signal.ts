// The wind-down request behind `/stop` and `/stop round`: a flag the task loop and the batch driver read
// at their own boundaries, so an overnight run can be brought to a halt without discarding the tasks it
// has already finished.
//
// It is deliberately NOT a cancellation. Cancelling kills the model call that is generating right now and
// belongs to a key; this asks the work in flight to reach its next natural end and stop there — the round
// finishes, or the whole task finishes with its verdict and commits. The two are separate on purpose: at
// 3am the useful instruction is almost always "wind down", not "throw away the last nine minutes".
//
// An INSTANCE rather than module state, so the loops that honour it take it as a dependency and can be
// driven in isolation (constitution: dependency inversion over hard-wired concretions). The session holds
// one and hands it to every /run; it is armed by the fence's control line and cleared when a run ends.

/**
 * How far a wind-down lets the work in flight run before it stops.
 *
 * - `round` — finish the round the Worker/Reviewer are in, then stop. The task ends without a verdict.
 * - `task`  — finish the whole task (through its verdict, commits and all), then stop before the next
 *             one. This is the setting an overnight batch wants: nothing already earned is discarded.
 *
 * There is no `now`: stopping instantly is what cancelling is for, and it is a different key.
 */
export type StopScope = 'round' | 'task';

export class RunStopSignal {
  /** The narrowest scope requested so far, or null while nothing has asked the run to stop. */
  private scope: StopScope | null = null;
  /** Whether a `/run` is in flight — nothing is stoppable outside one. */
  private running = false;

  /** A run is starting: it begins with no stop pending, whatever an earlier one left behind. */
  begin(): void {
    this.running = true;
    this.scope = null;
  }

  /** A run has ended. Clearing here is what stops a `/stop` from leaking into the NEXT `/run`. */
  end(): void {
    this.running = false;
    this.scope = null;
  }

  /**
   * Whether there is a run to stop. The input fence asks before claiming a `/stop` line, so that outside
   * a run the text falls through to the message queue and reaches the command registry as a real command
   * — which reports it as unknown, instead of the fence silently swallowing it and arming nothing.
   */
  get active(): boolean {
    return this.running;
  }

  /**
   * Ask the run to wind down at `scope`. Requests only ever TIGHTEN: once `/stop round` has been asked
   * for, a later `/stop` cannot loosen it back to "finish the whole task". Pressing for a sooner stop and
   * getting a later one would be the worst possible reading of the key.
   */
  request(scope: StopScope): void {
    if (this.scope === 'round') return;
    this.scope = scope;
  }

  /** True once anything has asked the run to wind down — used to report the request, not to act on it. */
  get requested(): boolean {
    return this.scope !== null;
  }

  /** The run should not start another ROUND (either scope stops the loop before a new round). */
  get stopBeforeNextRound(): boolean {
    return this.scope === 'round';
  }

  /** The batch should not start another TASK — true for both scopes, since `round` is the stricter one. */
  get stopBeforeNextTask(): boolean {
    return this.scope !== null;
  }
}
