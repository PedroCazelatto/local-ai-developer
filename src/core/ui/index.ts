// core/ui/ — persistent-REPL renderer, theme, spinner, and discrete prompts. Streaming output
// that preserves scrollback (never clears / never grabs the alt-buffer). Foundation task 05.
export { theme } from './theme.js';
export * as renderer from './renderer.js';
export * as statusBar from './status-bar.js';
export { startThinking, stopThinking } from './spinner.js';
export { confirm, select, textInput } from './prompts.js';
export type { SelectChoice } from './prompts.js';
export { confirmKey } from './confirm-key.js';
export { formatSize } from './format-size.js';
// A streamed, Ctrl-C-abortable model pull with a live ora line — shared by `/models pull|use` and the
// boot model resolution (hence the injected SigintSource: readline in the REPL, `process` at boot).
export { pullWithSpinner } from './pull-with-spinner.js';
export type { PullResult, SigintSource } from './pull-with-spinner.type.js';
