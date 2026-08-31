// core/ui/ — persistent-REPL renderer, theme, spinner, and discrete prompts. Streaming output
// that preserves scrollback (never clears / never grabs the alt-buffer). Foundation task 05.
export { theme } from './theme.js';
export * as renderer from './renderer.js';
export * as statusBar from './status-bar.js';
export * as activityLine from './activity-line.js';
export { confirm } from './confirm.js';
export { select } from './select.js';
export type { SelectChoice } from './select.js';
export { textInput } from './text-input.js';
export { confirmKey } from './confirm-key.js';
// Multi-line composition: Shift+Enter breaks the line instead of submitting it (repl.ts binds it).
export { bindNewlineKey } from './bind-newline-key.js';
// The input box stays fenced on screen while a turn runs, holding what is typed until the next prompt.
export * as inputFence from './input-fence.js';
export { formatSize } from './format-size.js';
export { terminalColumns } from './terminal-columns.js';
// The tool-call record in the scrollback: `→ <tool> <what it did>` before the call, `← <result>` (plus
// a compact diff, for the tools that change files) after it. Both are static history, never a widget.
export { printToolCall } from './print-tool-call.js';
export { printToolResult } from './print-tool-result.js';
export type { ToolResultView } from './print-tool-result.js';
export { formatToolCallLine, SUBAGENT_INDENT } from './format-tool-call-line.js';
export type { ToolCallLineInput } from './format-tool-call-line.js';
export { formatToolResultLines } from './format-tool-result-lines.js';
export type { ToolResultLinesInput } from './format-tool-result-lines.js';
export { toolCallSubject } from './tool-call-subject.js';
export type { ToolCallSubject } from './tool-call-subject.js';
export type { ToolCallDisplay, ToolDiffDisplay } from './types.js';
export { stripControlChars } from './strip-control-chars.js';
// Streamed markdown rendering (V6/01): the model writes plain markdown, the terminal colors it.
export { createMarkdownStream } from './create-markdown-stream.js';
export type { MarkdownStream } from './types.js';
// A deliberation loop printed into the scrollback: one block per turn, then the closing line. The digest
// goes to the model, the argument goes to the user (src/core/session/run-debate.ts).
export { renderDebateTurn } from './render-debate-turn.js';
export type { DebateTurnView } from './render-debate-turn.js';
export { renderDebateSummary } from './render-debate-summary.js';
export type { DebateSummaryView } from './render-debate-summary.js';
// The ask_user widget (V6/01) — a tabbed question panel; shared by the tool and `/questions`.
export { askQuestions } from './ask-questions.js';
export type { AskQuestion, AskOutcome } from './ask-questions.js';
// A streamed, Ctrl-C-abortable model pull with a live ora line — shared by `/models pull|use` and the
// boot model resolution (hence the injected SigintSource: readline in the REPL, `process` at boot).
export { pullWithSpinner } from './pull-with-spinner.js';
export type { PullResult, SigintSource } from './pull-with-spinner.js';
