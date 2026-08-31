// How many rows the status bar fences off at the bottom of the terminal, in one place because the
// count decides three separate things — the scroll region's bottom margin, which row each painter
// jumps to, and whether the terminal is tall enough to give the rows up at all. Two copies of that
// number is how two copies drift.

/** Rows reserved while idle: the rule, then status line 1, then status line 2. */
export const RESERVED_IDLE = 3;

/** Rows reserved while a turn runs: the input fence's rule + row, then the three above. */
export const RESERVED_BUSY = 5;
