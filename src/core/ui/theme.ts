// chalk color palette — ONE place for every color the UI uses (ports core/ui/theme.py's
// role→style map onto chalk). No raw color codes scattered around the renderer.

import chalk from 'chalk';

/** A color function: takes text, returns it wrapped in ANSI codes. */
type Styler = (s: string) => string;

// Per-phase accent for the assistant prefix + the phase field in the status line. The six
// phases (rules/phases/*.md) each get a distinct color so the active phase reads at a glance.
const PHASE_COLORS: Record<string, Styler> = {
  discovery: chalk.blueBright,
  design: chalk.cyan,
  breakdown: chalk.yellow,
  worker: chalk.green,
  reviewer: chalk.redBright,
  retro: chalk.magentaBright,
};

export const theme = {
  /** Accent color for a phase; falls back to white for an unknown name. */
  phase(name: string): Styler {
    return PHASE_COLORS[name.toLowerCase()] ?? chalk.white;
  },
  /** Meta / system lines (e.g. "→ tool: …") and status-line separators. */
  meta: chalk.dim as Styler,
  /** Recoverable-error lines (unknown /swap, surfaced tool errors). */
  error: chalk.red as Styler,
  /** The boot banner. */
  banner: chalk.bold as Styler,
  /** A passing outcome (e.g. a Reviewer PASS verdict). */
  success: chalk.greenBright as Styler,
  /** A failing / high-severity outcome (e.g. a Reviewer FAIL verdict, blocker/major issues). */
  danger: chalk.redBright as Styler,
  /** Emphasis for headlines / labels (task id, "Issues:"), without a color. */
  strong: chalk.bold as Styler,
};
