// core/ui/ — persistent-REPL renderer, theme, spinner, and discrete prompts. Streaming output
// that preserves scrollback (never clears / never grabs the alt-buffer). Foundation task 05.
export { theme } from './theme.js';
export * as renderer from './renderer.js';
export * as statusBar from './status-bar.js';
export * as activityLine from './activity-line.js';
export { confirm, select, textInput } from './prompts.js';
export type { SelectChoice } from './prompts.js';
export { confirmKey } from './confirm-key.js';
// Multi-line composition: Shift+Enter breaks the line instead of submitting it (repl.ts binds it).
export { bindNewlineKey } from './bind-newline-key.js';
export { formatSize } from './format-size.js';
export { terminalColumns } from './terminal-columns.js';
// Streamed markdown rendering (V6/01): the model writes plain markdown, the terminal colors it.
export { createMarkdownStream } from './create-markdown-stream.js';
export type { MarkdownStream } from './markdown-stream.type.js';
// The ask_user widget (V6/01) — a tabbed question panel; shared by the tool and `/questions`.
export { askQuestions } from './ask-questions.js';
export type { AskQuestion, AskOutcome } from './ask-questions.type.js';
// A streamed, Ctrl-C-abortable model pull with a live ora line — shared by `/models pull|use` and the
// boot model resolution (hence the injected SigintSource: readline in the REPL, `process` at boot).
export { pullWithSpinner } from './pull-with-spinner.js';
export type { PullResult, SigintSource } from './pull-with-spinner.type.js';
