// A yes/no confirmation through @clack/prompts, for a DISCRETE choice rather than the chat line.
// clack's cancel symbol is mapped here so no caller has to import `isCancel` itself.
//
// Not to be confused with confirm-key.ts, which reads a single keypress off a raw stdin the REPL
// already owns. This one hands the terminal to clack for the length of the prompt.

import { confirm as clackConfirm, isCancel } from '@clack/prompts';

/** Yes/no confirmation. Returns false if the user cancels (Ctrl+C / Esc). */
export async function confirm(message: string): Promise<boolean> {
  const result = await clackConfirm({ message });
  return isCancel(result) ? false : result;
}
