// Free-text entry through @clack/prompts, for a DISCRETE prompt — never the main chat line, which is
// readline's (repl.ts). clack's cancel symbol is mapped to null here so no caller has to import
// `isCancel` itself.

import { text as clackText, isCancel } from '@clack/prompts';

/** Free-text input for a discrete prompt (not the main chat line). Returns null if cancelled. */
export async function textInput(message: string, placeholder?: string): Promise<string | null> {
  const result = await clackText({ message, placeholder });
  return isCancel(result) ? null : result;
}
