// Commit-message authorship for commit_changes (backlog: per-phase commits). The phase that commits
// NEVER writes its own message: the message is written by a SUB-AGENT in the project's own sense of the
// word — a fresh, empty messages array with a one-shot system prompt, run against the same Ollama and
// then discarded (ctx.oneShot). Two reasons this is the mechanism rather than the SubagentManager:
// oneShot exists in EVERY context (the Reviewer window has no manager), and its turns never enter any
// phase's memory, so a message-writing round trip costs the committing phase nothing.
//
// The writer is shown the REAL diff, not the phase's description of it — a phase that misdescribes its
// own change cannot talk the log into agreeing. The phase's `intent` rides along only as the "why".

import type { Message } from 'ollama';

import type { OneShotRole } from '../core/llm/one-shot-role.type.js';
import type { OneShotResult } from '../core/llm/one-shot.js';
import { stripAttributionTrailers } from './strip-attribution-trailers.js'; // no trailer may ever name a person
import { unwrapCommitMessage } from './unwrap-commit-message.js'; // NOT unwrapTitle: a message has a body

/** Subject-line ceiling; the writer is asked for ≤72 and anything longer is hard-truncated. */
const SUBJECT_LIMIT = 72;

// No author/co-author trailer and no human name may ever reach a commit message (constitution: the
// user's name is never written into any file). The prompt forbids it AND stripAttributionTrailers drops any the
// model invents anyway — a confidently-wrong local model must not be able to sign a commit.
const SYSTEM_PROMPT = `You write git commit messages. You are given the real diff of a change and a one-line statement of why it was made. Reply with the commit message and NOTHING else.

Rules:
- Conventional Commits: "<type>(<scope>): <subject>", type one of feat, fix, docs, refactor, test, chore.
- Subject: imperative mood, lower case, no trailing period, at most ${SUBJECT_LIMIT} characters.
- Optionally add ONE blank line then a body of at most 3 short lines explaining WHY, not what.
- Describe only what the diff actually shows. Never invent a change that is not there.
- Never add Signed-off-by, Co-authored-by, Author, or any other trailer. Never name a person.
- No markdown, no code fences, no quotes around the message, no preamble such as "Here is".`;

export interface ComposeCommitMessageInput {
  /**
   * ToolContext.oneShot — a fresh, HISTORY-FREE call to the session model. Passed in rather than
   * imported so the writer never reaches for the session's client itself (dependency inversion), and
   * so the committing phase's own context is provably untouched. Takes the role, like the context it
   * comes from, so this file names the ceiling it runs under rather than inheriting one silently.
   */
  readonly oneShot: (messages: Message[], role: OneShotRole) => Promise<OneShotResult>;
  /** The real `git diff` of exactly the paths being staged — the writer's primary evidence. */
  readonly diff: string;
  /** The committing phase's one-line statement of WHY these files changed. Context, not the message. */
  readonly intent: string;
  /** Project-relative paths in this commit — listed for the writer when the diff is empty/truncated. */
  readonly paths: readonly string[];
}

/**
 * Ask the throwaway context for this commit's message, then normalize it into something git can take:
 * unwrap the model's packaging, drop attribution trailers, cap the subject, and collapse the body.
 * Falls back to a plain `chore:` line built from the intent when the model returns nothing usable —
 * a commit is never blocked on the message writer, and the fallback is honestly generic rather than a
 * fabricated description of a diff nobody read.
 */
export async function composeCommitMessage(input: ComposeCommitMessageInput): Promise<string> {
  const intent = input.intent.trim();
  const evidence =
    input.diff.trim() === ''
      ? `Files in this commit:\n${input.paths.join('\n')}\n\n(No textual diff — the change may be a deletion or a binary file.)`
      : `Files in this commit:\n${input.paths.join('\n')}\n\nDiff:\n${input.diff}`;

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Why this change was made: ${intent}\n\n${evidence}` },
  ];

  // oneShot: one fresh call to the session model with NO history and NO tools; its turns are never
  // appended to any phase's memory, so this costs the committing phase nothing but wall-clock.
  // 'commit-message' is a BOUNDED role — safe under a smaller ceiling because the diff above is already
  // capped at REVIEW_DIFF_BUDGET, whose 12 000 characters measure 3 298 prompt tokens at their worst.
  const { content } = await input.oneShot(messages, 'commit-message');
  const lines = stripAttributionTrailers(unwrapCommitMessage(content).split(/\r?\n/)).map((line) => line.trimEnd());

  const subjectIndex = lines.findIndex((line) => line.trim() !== '');
  if (subjectIndex === -1) {
    return `chore: ${intent.slice(0, SUBJECT_LIMIT - 'chore: '.length)}`;
  }

  const subject = (lines[subjectIndex] ?? '').trim().slice(0, SUBJECT_LIMIT);
  const body = lines.slice(subjectIndex + 1).join('\n').trim();
  return body === '' ? subject : `${subject}\n\n${body}`;
}
