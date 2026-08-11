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

// Heading accent by level (#, ##, ###+). The model writes plain markdown and never names a color —
// the mapping from construct to color lives HERE and nowhere else, so the palette stays swappable.
const HEADING_STYLES: readonly Styler[] = [chalk.bold.cyanBright, chalk.bold.cyan, chalk.bold.blueBright];

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
  /** The full-width horizontal rules fencing the input line (repl.ts). */
  divider: chalk.dim as Styler,
  /**
   * The drawn caret in the type-ahead input row that stays fenced while a turn runs
   * (input-fence-row.ts). The REAL terminal cursor is down in the scrolling area with the streamed
   * output, so that pinned row needs a caret of its own to read as live rather than as a picture.
   */
  caret: chalk.inverse as Styler,
  /**
   * A submitted user message, echoed back into the scrollback as one static line: light-gray
   * background with dark text so the user's turns read distinctly from the model's (repl.ts,
   * commitUserMessage). Retune the shade here — the one place any color lives.
   */
  userMessage: chalk.bgAnsi256(250).black as Styler,
  /**
   * The two sides of a deliberation loop (run-debate.ts), printed as headers above each turn. Their own
   * roles rather than a reuse of success/danger: a challenger is not a failure and a proponent is not a
   * pass — they are two voices, and the eye only has to tell them apart. Red attacks, green defends,
   * which is the one convention a reader already has.
   */
  debate: {
    challenger: chalk.bold.redBright as Styler,
    proponent: chalk.bold.greenBright as Styler,
  },
  /**
   * The two sides of the compact diff printed after a write_file / edit_file call
   * (format-tool-result-lines.ts). Their own roles rather than a reuse of success/danger, on the same
   * reasoning as the debate pair above: an added line is not a pass and a removed line is not a
   * failure — they are the two halves of one change, and green-adds/red-removes is the single
   * convention every reader already has for a diff.
   */
  diff: {
    added: chalk.green as Styler,
    removed: chalk.red as Styler,
  },
  /**
   * Markdown roles. The model emits PLAIN markdown and never picks a color (see system-prompt.ts);
   * render-markdown-line.ts maps each construct onto exactly one role below. Colors live only here,
   * so the whole markdown look is retuned in one place. Yellow means "code" everywhere — inline and
   * fenced alike — so the eye learns one rule.
   */
  md: {
    /** `#`/`##`/`###+` — brightest at level 1, so nesting reads as depth. */
    heading(level: number): Styler {
      return HEADING_STYLES[Math.min(level, HEADING_STYLES.length) - 1] ?? chalk.bold;
    },
    /** `**bold**` / `__bold__`. */
    bold: chalk.bold.whiteBright as Styler,
    /** `*italic*` / `_italic_`. */
    italic: chalk.italic as Styler,
    /** `` `inline code` `` and the body of a fenced block — one color for code. */
    code: chalk.yellow as Styler,
    /** The ``` marker line opening/closing a fenced block. */
    fence: chalk.dim as Styler,
    /** The `•` / `1.` marker of a list item (the item's text is styled inline, not by this). */
    bullet: chalk.cyan as Styler,
    /** `> quoted` body text. */
    quote: chalk.dim as Styler,
    /** The `│` gutter drawn in place of a blockquote's `>`. */
    quoteBar: chalk.dim as Styler,
    /** A `---` / `***` thematic break, rendered as a drawn rule. */
    rule: chalk.dim as Styler,
  },
};
