// Print one debate turn into the scrollback: a colored role header, then the turn's prose rendered as
// markdown and indented under it. The user watches the argument happen rather than being handed a
// verdict with no visible reasoning — the digest goes to the model, the transcript goes to the user.
//
// Append-only, like everything else in history (constitution, Terminal UX): the block is written once
// and never revisited. It goes out through renderer.interjectLine because a debate runs INSIDE a tool
// call, where the transient activity line owns the cursor row — interjectLine lifts it, writes, and puts
// it back. Writing to stdout directly here would print through that line.

import { debateBodyRows } from './debate-body-rows.js';
import { renderer } from './renderer.js';
import { theme } from './theme.js';

/**
 * The view this file prints. Declared HERE, not imported from core/session, so the renderer stays a
 * leaf: ui/ knows how to draw a labeled block of markdown and nothing about how a debate runs. It is
 * structurally the session layer's DebateTurn, so a turn passes straight through with no mapping.
 */
export interface DebateTurnView {
  readonly role: 'proponent' | 'challenger';
  /** 1-based round number, shown in the header. */
  readonly round: number;
  /** The turn's prose, as plain markdown. */
  readonly body: string;
  /** True on the challenger turn that ended the debate — marked in the header, not in the body. */
  readonly conceded: boolean;
}

/** Print `turn` as one block: blank line, header, indented body. */
export function renderDebateTurn(turn: DebateTurnView): void {
  const style = turn.role === 'challenger' ? theme.debate.challenger : theme.debate.proponent;
  const suffix = turn.conceded ? ' · conceded' : '';
  const header = style(`${turn.role} ▸ round ${turn.round}${suffix}`);
  // debateBodyRows: the turn's markdown, styled by the same renderer the streamed reply uses and
  // word-wrapped under a two-space indent.
  renderer.interjectLine(['', header, ...debateBodyRows(turn.body)].join('\n'));
}
