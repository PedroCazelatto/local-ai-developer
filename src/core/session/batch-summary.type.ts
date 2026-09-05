// The persisted record of one unattended batch run (V3/05).
//
// A PARTIAL summary is still written when the batch aborts on an infra fault or a pre-flight refusal --
// the whole value of an overnight run is that it reports what it did, not that it finished.

import type { BatchBlocked } from './batch-blocked.type.js';
import type { BatchCancelled } from './batch-cancelled.type.js';
import type { BatchEscalated } from './batch-escalated.type.js';
import type { BatchPassed } from './batch-passed.type.js';
import type { BatchSkipped } from './batch-skipped.type.js';
import type { TokenCounts } from '../llm/index.js';

/** One unattended batch's persisted outcome — written under .orchestrator/batches/ for the morning after. */
export interface BatchSummary {
  /** Sequential batch number (also the persisted file-name prefix). */
  readonly seq: number;
  readonly startedAt: string; // UTC ISO
  readonly finishedAt: string; // UTC ISO
  /** Tasks actually run through the loop this batch (passed + escalated + blocked). */
  readonly total: number;
  readonly passed: BatchPassed[];
  readonly escalated: BatchEscalated[];
  readonly blocked: BatchBlocked[];
  readonly cancelled: BatchCancelled[];
  readonly skipped: BatchSkipped[];
  /** EXACT sum of every task's loop tokens (a null field means some turn omitted it — never estimated). */
  readonly tokens: TokenCounts;
  /** Present only when a pre-flight refusal or an infra fault stopped the batch early. */
  readonly abortedReason?: string;
  /**
   * Present only when the USER wound the batch down (`/stop`, `/stop round`, or Ctrl+C). Separate from
   * `abortedReason`, which means the batch broke: a deliberate stop is not a fault and must not be
   * reported as one, and the tasks it had already finished are all still in their own buckets.
   */
  readonly stoppedReason?: string;
}
