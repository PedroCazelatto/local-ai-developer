// submit_verdict (V2/01) — the Reviewer's phase-scoped verdict tool. It is deliberately NOT in the
// global registry (registry.ts): only the spawned Reviewer window offers it, and the Reviewer calls
// it EXACTLY ONCE with args that ARE the ReviewVerdict. We send this Tool definition to the model in
// the Reviewer's tool list; the window then captures + validates the args (parseVerdict) and ends
// the turn.
//
// Chosen over a fenced-```json block so the verdict rides the SAME tool-call recovery pipeline every
// other tool uses (client.ts recovers calls the local model emits as bare JSON / <tool_call> tags) —
// reliable across any model/hardware. Validation is strict here because downstream trusts the shape.

import type { Tool } from '../core/llm/index.js';
import type { ReviewIssue, ReviewVerdict, Severity } from '../core/session/types.js';
import { SEVERITIES } from '../core/session/types.js';

/** The one name the Reviewer window special-cases to capture its verdict. */
export const SUBMIT_VERDICT = 'submit_verdict';

/** The Ollama tool definition appended to the Reviewer's (read-mostly) tool list. */
export const submitVerdictTool: Tool = {
  type: 'function',
  function: {
    name: SUBMIT_VERDICT,
    description:
      'Submit your FINAL review verdict for this task — exactly once, when you are done judging. ' +
      'Set result "pass" ONLY if BOTH behavior and standards pass; any blocker or major issue means "fail". ' +
      'Every issue must be concrete and actionable, naming the offending file and the fix direction. ' +
      'Calling this ends the review — do not call any other tool afterward.',
    parameters: {
      type: 'object',
      required: ['result', 'summary', 'issues'],
      properties: {
        result: {
          type: 'string',
          enum: ['pass', 'fail'],
          description: 'Overall verdict. "pass" = behavior AND standards both satisfied.',
        },
        summary: {
          type: 'string',
          description: '1–3 sentences: the overall judgment, weighed against the task acceptance criteria.',
        },
        issues: {
          type: 'array',
          description:
            'Concrete problems. Empty ([]) when result is "pass"; at least one when "fail". ' +
            'No blocker/major entry may accompany a "pass" (downgrade to minor or set result to "fail").',
          items: {
            type: 'object',
            required: ['severity', 'file', 'note'],
            properties: {
              severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
              file: { type: 'string', description: 'Project-relative path, or "" if not file-specific.' },
              note: { type: 'string', description: 'What is wrong and the fix direction — actionable.' },
            },
          },
        },
      },
    },
  },
};

/** Result of parsing a submit_verdict payload: a valid verdict, or a message the model can fix from. */
export type VerdictParse = { readonly ok: true; readonly verdict: ReviewVerdict } | { readonly ok: false; readonly error: string };

function invalid(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);
}

function describe(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

function parseIssue(raw: unknown, index: number): { ok: true; issue: ReviewIssue } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return invalid(`issues[${index}] must be an object with severity, file, and note.`);
  }
  const record = raw as Record<string, unknown>;
  if (!isSeverity(record['severity'])) {
    return invalid(`issues[${index}].severity must be one of ${SEVERITIES.join(', ')} (got ${describe(record['severity'])}).`);
  }
  const note = record['note'];
  if (typeof note !== 'string' || note.trim() === '') {
    return invalid(`issues[${index}].note must be a non-empty, actionable string.`);
  }
  // file is optional-in-spirit: "" when not file-specific. Coerce a missing/non-string to "".
  const file = typeof record['file'] === 'string' ? record['file'] : '';
  return { ok: true, issue: { severity: record['severity'], file, note: note.trim() } };
}

/**
 * Validate a submit_verdict payload into a ReviewVerdict, enforcing the consistency rule the
 * orchestrator relies on: result "pass" ⇒ no blocker/major issues; result "fail" ⇒ at least one
 * issue. On any violation returns a concrete `error` string the Reviewer can act on and re-submit.
 */
export function parseVerdict(args: Record<string, unknown>): VerdictParse {
  const result = args['result'];
  if (result !== 'pass' && result !== 'fail') {
    return invalid(`"result" must be "pass" or "fail" (got ${describe(result)}).`);
  }
  const summary = args['summary'];
  if (typeof summary !== 'string' || summary.trim() === '') {
    return invalid('"summary" must be a non-empty string describing the overall judgment.');
  }
  const rawIssues = args['issues'] ?? [];
  if (!Array.isArray(rawIssues)) {
    return invalid('"issues" must be an array (use [] when there are none).');
  }

  const issues: ReviewIssue[] = [];
  for (let i = 0; i < rawIssues.length; i += 1) {
    const parsed = parseIssue(rawIssues[i], i);
    if (!parsed.ok) return parsed;
    issues.push(parsed.issue);
  }

  if (result === 'pass') {
    const blocking = issues.find((issue) => issue.severity === 'blocker' || issue.severity === 'major');
    if (blocking !== undefined) {
      return invalid(
        `result is "pass" but issue for "${blocking.file || '(no file)'}" is severity "${blocking.severity}". ` +
          'A pass may carry only "minor" issues — downgrade the severity or set result to "fail".',
      );
    }
  } else if (issues.length === 0) {
    return invalid('result is "fail" but "issues" is empty. A fail must list at least one concrete issue.');
  }

  return { ok: true, verdict: { result, summary: summary.trim(), issues } };
}
