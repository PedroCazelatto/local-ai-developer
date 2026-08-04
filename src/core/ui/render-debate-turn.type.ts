// The view render-debate-turn.ts prints. Declared HERE, not imported from core/session, so the renderer
// stays a leaf: ui/ knows how to draw a labeled block of markdown and nothing about how a debate runs.
// It is structurally the session layer's DebateTurn, so a turn passes straight through with no mapping.

export interface DebateTurnView {
  readonly role: 'proponent' | 'challenger';
  /** 1-based round number, shown in the header. */
  readonly round: number;
  /** The turn's prose, as plain markdown. */
  readonly body: string;
  /** True on the challenger turn that ended the debate — marked in the header, not in the body. */
  readonly conceded: boolean;
}
