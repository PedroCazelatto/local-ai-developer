// The body of /questions: re-ask the questions the model asked and the user skipped, one round per
// asking phase. Split out of questions.ts, which is now the assembler that registers it.
//
// The same tabbed panel ask_user uses is reused verbatim, so answering a saved question feels
// identical to answering it in the moment — and a question skipped again is simply still pending.

import { answerQuestion } from '../../core/session/answer-question.js';
import { readPendingQuestions } from '../../core/session/read-pending-questions.js';
import { askQuestions } from '../../core/ui/ask-questions.js';
import { renderer } from '../../core/ui/renderer.js';
import { statusBar } from '../../core/ui/status-bar.js';
import { groupQuestionsByPhase } from './group-questions-by-phase.js';

/** The slice of the orchestrator /questions needs — satisfied structurally by SessionOrchestrator. */
export interface QuestionsOrchestrator {
  /** Host path to projects/<active> — the question store lives under its .orchestrator/. */
  readonly projectPath: string;
}

/** Re-ask every saved question, phase by phase, persisting each answer the user gives. */
export async function runQuestions(orch: QuestionsOrchestrator): Promise<void> {
  // readPendingQuestions: every `asked` row with no `answered` row, replayed off the JSONL.
  const pending = readPendingQuestions(orch.projectPath);
  if (pending.length === 0) {
    renderer.systemMessage('No saved questions. The model asks them with ask_user; skipped ones land here.');
    return;
  }
  // groupQuestionsByPhase: the pending questions bucketed by the phase that asked, so each panel is
  // one coherent round rather than a scramble across phases.
  for (const [phase, questions] of groupQuestionsByPhase(pending)) {
    // askQuestions: the same tabbed panel ask_user draws. Index-aligned answers; null = skipped again.
    const outcome = await askQuestions(phase, questions.map((q) => ({ question: q.question, options: q.options })));
    questions.forEach((question, index) => {
      const answer = outcome.answers[index];
      if (answer === undefined || answer === null) return; // still pending — it stays in the store
      answerQuestion(orch.projectPath, question.id, answer);
    });
  }
  // The panel moved the cursor around inside the scroll region; readline's rows are repainted by the
  // REPL on its next prompt, but restore them now so the bottom of the screen is never briefly stale.
  statusBar.repaint();
  const stillPending = readPendingQuestions(orch.projectPath).length;
  renderer.systemMessage(
    stillPending === 0
      ? 'All saved questions answered. The answers reach the phase that asked on its next turn.'
      : `${stillPending} question(s) still saved. The answers you gave reach their phase on its next turn.`,
  );
}
