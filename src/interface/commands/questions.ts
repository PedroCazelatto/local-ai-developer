// /questions (V6/01) — re-open the questions the model asked and the user skipped. A user command,
// never a model tool: the model asks through ask_user, the user answers on their own schedule, here.
//
// It closes the loop ask_user opens. Skipping a question during a round is normal — the answer may
// need thought, or a look at something else first — so the question is saved rather than lost, and
// this is where the user comes back to it. Answers are handed to the phase that asked, on its next
// turn (SessionOrchestrator.deliverAnsweredQuestions), even across a phase swap or a restart.
//
// The same tabbed panel ask_user uses is reused verbatim, so answering a saved question feels
// identical to answering it in the moment — and a question skipped again is simply still pending.

import { answerQuestion, readPendingQuestions } from '../../core/session/index.js';
import type { PendingQuestion } from '../../core/session/index.js';
import { askQuestions } from '../../core/ui/ask-questions.js';
import * as renderer from '../../core/ui/renderer.js';
import * as statusBar from '../../core/ui/status-bar.js';
import type { Command } from '../command-registry.js';

/** The slice of the orchestrator /questions needs — satisfied structurally by SessionOrchestrator. */
export interface QuestionsOrchestrator {
  /** Host path to projects/<active> — the question store lives under its .orchestrator/. */
  readonly projectPath: string;
}

/**
 * Group by the phase that asked, so a mixed backlog is put back as coherent rounds rather than one
 * scrambled list — a Discovery question and a Design question want different heads.
 */
function byPhase(questions: readonly PendingQuestion[]): Map<string, PendingQuestion[]> {
  const grouped = new Map<string, PendingQuestion[]>();
  for (const question of questions) {
    const existing = grouped.get(question.phase);
    if (existing === undefined) grouped.set(question.phase, [question]);
    else existing.push(question);
  }
  return grouped;
}

async function runQuestions(orch: QuestionsOrchestrator): Promise<void> {
  // readPendingQuestions: every `asked` row with no `answered` row, replayed off the JSONL.
  const pending = readPendingQuestions(orch.projectPath);
  if (pending.length === 0) {
    renderer.systemMessage('No saved questions. The model asks them with ask_user; skipped ones land here.');
    return;
  }
  for (const [phase, questions] of byPhase(pending)) {
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

export const questionsCommand: Command = {
  name: 'questions',
  group: 'session',
  description: 'Answer the questions the model asked that you skipped',
  usage: '/questions',
  run: (ctx) => runQuestions(ctx.orch),
};
