// Types for ask-questions.ts + render-question-panel.ts (constitution: types live in a sibling
// file, never inline). The widget is deliberately id-free: it answers by POSITION, so the caller
// owns identity. ask_user has no ids yet at ask time (the store mints them only for questions that
// end up unanswered), while /questions re-asks questions that already have ids — one widget serves
// both because neither has to teach it their id scheme.

/** One question to put to the user. `options` is what the MODEL proposed — never the full list. */
export interface AskQuestion {
  readonly question: string;
  /** The model's suggested answers. The widget appends its own free-text choice below them. */
  readonly options: readonly string[];
}

/** The result of one widget session. */
export interface AskOutcome {
  /**
   * Index-aligned with the questions passed in: the chosen option / typed text, or null where the
   * user moved on without answering. A null is not a failure — it is a question the caller must
   * persist so it can be answered later (question-store.ts).
   */
  readonly answers: readonly (string | null)[];
}

/** How the widget is currently reading input: picking from the list, or typing a free-text answer. */
export type QuestionPanelMode = 'select' | 'text';

/** Everything render-question-panel.ts needs to draw one frame. A snapshot — the panel is pure. */
export interface QuestionPanelState {
  /** Who is asking, for the panel's title (the active phase name). */
  readonly phase: string;
  readonly questions: readonly AskQuestion[];
  /** Index-aligned with `questions`: the model's options PLUS the appended free-text choice. */
  readonly options: readonly (readonly string[])[];
  /** Index-aligned with `questions`: the answer so far, or null. */
  readonly answers: readonly (string | null)[];
  /** Active tab: 0..questions.length-1 are questions, questions.length is the Review tab. */
  readonly tab: number;
  /** Highlighted option within the active question. */
  readonly cursor: number;
  readonly mode: QuestionPanelMode;
  /** The free-text being typed, when mode is 'text'. */
  readonly draft: string;
}
