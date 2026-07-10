// core/ui/ — persistent-REPL renderer, theme, spinner, and discrete prompts. Streaming output
// that preserves scrollback (never clears / never grabs the alt-buffer). Foundation task 05.
export { theme } from './theme.js';
export * as renderer from './renderer.js';
export * as statusBar from './status-bar.js';
export { startThinking, stopThinking } from './spinner.js';
export { confirm, select, textInput } from './prompts.js';
export type { SelectChoice } from './prompts.js';
