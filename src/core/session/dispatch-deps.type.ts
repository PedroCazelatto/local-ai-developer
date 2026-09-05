// What the dispatcher optionally binds to. The audit sink is injected rather than imported, so the
// dispatcher writes nothing itself and a window can audit through its own sink (a sub-agent stamps its
// lineage that way).

import type { ToolCallRecord } from './tool-call-record.type.js';

export interface DispatchDeps {
  /** Audit sink — called once per dispatched call (success or failure). Wired by V1/06. */
  readonly onToolCall?: (record: ToolCallRecord) => void;
}
