// Question store — append-only JSONL at projects/<active>/.orchestrator/questions.jsonl, the same
// discipline as blocker-store.ts: one JSON line per event, fsync'd per row, state derived by REPLAY
// rather than mutated in place. It is durable session state (git-ignored alongside the audit log),
// NOT project history.
//
// It holds only what the user did NOT answer. A question answered on the spot is already in the
// ask_user tool result and needs no life beyond the turn; a question skipped is a debt the model is
// owed, and must outlive the turn, the phase swap, and a restart.
//
// The lifecycle is three rows: `asked` when it is saved, `answered` when /questions collects the
// answer, `delivered` once that answer has been injected into its phase's context. Delivery is
// recorded precisely so an answer reaches the window exactly once — replaying it every turn would
// quietly re-inject the same text and burn context on a VRAM-bound box.
//
// This is a cohesive store module (like blocker-store.ts): a few tightly-related readers/writers
// over one file, not one function per file.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { appendJsonlLine } from './append-jsonl-line.js';
import type { AnsweredQuestion, PendingQuestion, QuestionRow } from './question-store.type.js';

/** Absolute path to the project's questions.jsonl (session state under .orchestrator/). */
function questionsFile(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'questions.jsonl');
}

/** Read + parse every row; a malformed line is skipped (a torn last line must not sink replay). */
function readRows(projectPath: string): QuestionRow[] {
  const file = questionsFile(projectPath);
  if (!existsSync(file)) return [];
  const rows: QuestionRow[] = [];
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isQuestionRow(parsed)) rows.push(parsed);
    } catch {
      // A partial/torn line (e.g. a kill mid-write) — skip it, keep replaying the intact rows.
    }
  }
  return rows;
}

/** Narrow a parsed JSON value to a QuestionRow (defensive — the file is hand-inspectable). */
function isQuestionRow(value: unknown): value is QuestionRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  if (row['kind'] === 'asked') {
    return (
      typeof row['id'] === 'string' &&
      typeof row['phase'] === 'string' &&
      typeof row['question'] === 'string' &&
      Array.isArray(row['options'])
    );
  }
  if (row['kind'] === 'answered') {
    return typeof row['id'] === 'string' && typeof row['answer'] === 'string';
  }
  if (row['kind'] === 'delivered') {
    return typeof row['id'] === 'string';
  }
  return false;
}

/**
 * Persist the questions the user left unanswered, minting each id as `${phase}#${n}` from the count
 * of questions this phase has ever saved. Ids are assigned HERE, at write time, and never at ask
 * time: only a fraction of a batch is normally saved, so an id derived before the widget ran would
 * be handed out again on the next call and collide. No parallelism (CLAUDE.md), so count-then-append
 * is race-free. Returns the saved questions, ids included.
 */
export function saveUnansweredQuestions(
  projectPath: string,
  phase: string,
  questions: readonly { readonly question: string; readonly options: readonly string[] }[],
): PendingQuestion[] {
  const priorForPhase = readRows(projectPath).filter((row) => row.kind === 'asked' && row.phase === phase).length;
  const saved: PendingQuestion[] = [];
  questions.forEach((question, index) => {
    const pending: PendingQuestion = {
      id: `${phase}#${priorForPhase + index + 1}`,
      phase,
      question: question.question,
      options: [...question.options],
      askedAt: new Date().toISOString(),
    };
    appendJsonlLine(questionsFile(projectPath), { kind: 'asked', ...pending });
    saved.push(pending);
  });
  return saved;
}

/** Every question still awaiting an answer — an `asked` row with no matching `answered` row. */
export function readPendingQuestions(projectPath: string): PendingQuestion[] {
  const rows = readRows(projectPath);
  const answeredIds = new Set(rows.filter((row) => row.kind === 'answered').map((row) => row.id));
  return rows.filter((row): row is { kind: 'asked' } & PendingQuestion => row.kind === 'asked' && !answeredIds.has(row.id));
}

/** Record the user's answer to a pending question (from /questions). */
export function answerQuestion(projectPath: string, id: string, answer: string): void {
  appendJsonlLine(questionsFile(projectPath), { kind: 'answered', id, answer, answeredAt: new Date().toISOString() });
}

/**
 * Take the answers owed to `phase` and mark them delivered in the same breath: an `answered` row
 * with no `delivered` row, for a question that phase asked. The caller injects the returned answers
 * into that phase's context; the `delivered` rows written here are what guarantee it happens exactly
 * once, even across a restart.
 */
export function drainAnsweredQuestions(projectPath: string, phase: string): AnsweredQuestion[] {
  const rows = readRows(projectPath);
  const deliveredIds = new Set(rows.filter((row) => row.kind === 'delivered').map((row) => row.id));
  const asked = new Map(
    rows.filter((row): row is { kind: 'asked' } & PendingQuestion => row.kind === 'asked').map((row) => [row.id, row]),
  );
  const drained: AnsweredQuestion[] = [];
  for (const row of rows) {
    if (row.kind !== 'answered' || deliveredIds.has(row.id)) continue;
    const question = asked.get(row.id);
    if (question === undefined || question.phase !== phase) continue;
    drained.push({
      id: row.id,
      phase: question.phase,
      question: question.question,
      answer: row.answer,
      answeredAt: row.answeredAt,
    });
    appendJsonlLine(questionsFile(projectPath), { kind: 'delivered', id: row.id, deliveredAt: new Date().toISOString() });
  }
  return drained;
}
