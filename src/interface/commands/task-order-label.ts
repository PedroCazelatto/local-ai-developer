// A task's execution position as the tree prints it. Split out of render-task-tree.ts; `orderLabel`
// was qualified to `taskOrderLabel` because "order" alone names no subject once the function is a
// file a stranger reads first.

/**
 * `#3`, or `#?` when the task set no order and its file name carries no leading number — readBacklog
 * sorts those last with a sentinel, and printing the sentinel's raw value would be noise pretending
 * to be a position (constitution: surface an absent value, never dress it up).
 */
export function taskOrderLabel(order: number): string {
  return order === Number.MAX_SAFE_INTEGER ? '#?' : `#${order}`;
}
