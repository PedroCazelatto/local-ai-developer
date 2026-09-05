# The naming half of "one function per file" was never measured

**Category:** Repo hygiene / verification

The rule has two halves. The constitution states both in one sentence:

> Each code file holds **exactly one function** … **The kebab-case file name names that function's job.**

Backlog item 1's sweep measured the **first** half exhaustively — a TypeScript-parser census over
`src/statements`, driven to zero and re-run after every wave. It **never measured the second half at
all.** Every "0 violations" figure in that brief is a count of declarations per file and says nothing
about whether the declaration is named after the file.

That is not a small omission: a count-only census passes `src/commands/run.ts`, which declares
`run` and dispatches `/models` ([item 35](commands-have-two-homes.md)).

## What a first scan found

Comparing each single-declaration file's name to its declaration's, over 753 files, **62 disagree**.
Sorted, almost all of them are conventions rather than defects — which is the point of writing this
down, because the next person to run the check will otherwise re-flag all 62:

| group | n | verdict |
|---|---|---|
| `xTool` in `x.ts` (`askSubagentTool` / `ask-subagent.ts`) | 23 | **Convention.** The user's tool ruling: the tool's model-facing name *is* the file name. Not a defect. |
| `xCommand` in `x.ts` (`answerCommand` / `answer.ts`) | 15 | **Convention.** The command-object shape, applied uniformly. Not a defect. |
| PascalCase class in a kebab file (`StreamFilter` / `stream-filter.ts`) | 10 | **Not a defect.** Classes are PascalCase in TypeScript; the kebab name still states the job. |
| Other deliberate suffixes (`SandboxClient` / `sandbox.ts`, `PromptNotFoundError` / `prompt.ts`, three more error classes) | 5 | **Mostly fine**, but `prompt.ts` declaring only `PromptNotFoundError` deserves a look — the file is named for a job it does not do. |
| SCREAMING_CASE constants (`NO_SUBJECT` / `no-subject.ts`, `TASK_STATUS_LABEL`, `PHASE_TOOL_NAMES`) | 3 | **Not a defect.** A constants file is explicitly allowed, and the name matches but for case. |
| Verb prefix on a noun file (`buildSystemPrompt` / `system-prompt.ts`, `createReadTracker` / `read-tracker.ts`, `PhaseFactory` / `factory.ts`) | 3 | **Needs a ruling.** The file names the thing, the function names the action. |
| **Genuine disagreements** | 3 | `appendAuditRow` / `audit.ts`, `appendEvent` / `events-log.ts`, `SubagentManager` / `subagents.ts`. |

So the honest total is **3 clear defects, 3 that need a ruling, and 56 that are the conventions
working as intended** — plus `src/commands/run.ts`, which no name check can catch.

## The part worth keeping

**Name-to-filename agreement is checkable. Name-to-*job* agreement is not.** `run.ts` declaring `run`
is an exact match and still violates the rule, because the job is dispatching `/models`. Any future
census should therefore report the mechanical check *and* say plainly that it does not cover the rule
as worded — otherwise a green run is read as more than it is, which is the
[sweep brief's](split-config-into-one-function-per-file.md) whole subject.

## Decisions, open

- **Are the 56 conventions written into the constitution as named allowances?** Stating them is what
  stops the next census re-litigating them. It is also the honest way to record that the rule has
  always had exceptions in practice, whatever the "no exceptions" wording says about *counts*.
- **Do the three verb-prefix files get renamed, or does the rule allow a verb on a noun file?**
  `system-prompt.ts` → `build-system-prompt.ts` is the mechanical answer; deciding the general form
  is the useful one.
- **Do the three genuine disagreements get renamed, or do their files get renamed?**
  `audit.ts` → `append-audit-row.ts` and `events-log.ts` → `append-event.ts` read as the obvious
  direction. `subagents.ts` → `subagent-manager.ts` is the same shape as the class renames the sweep
  already did.
- **Should the check run as part of `npm test`?** It is a pure function over the file list and would
  hold the line permanently — but it needs the allowance list above to exist first, or it fails on 56
  files that are correct.

## Why it sits where it does

It is filed rather than fixed because **every remaining question is a naming judgement**, and because
the allowance list has to be agreed before a check can be written. Nothing is broken; the value is in
not believing a figure that was never measured.
