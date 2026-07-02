// Thin @clack/prompts wrappers for DISCRETE choices — confirmations and batch selection (later:
// "run one / some / all tasks"). Foundation only wires the primitives so 06 and V1 can call
// them; there's no confirmation use-site yet. Each wrapper maps clack's cancel symbol to a null
// / false so callers never have to import `isCancel` themselves.

import { confirm as clackConfirm, select as clackSelect, text as clackText, isCancel } from '@clack/prompts';

/** Yes/no confirmation. Returns false if the user cancels (Ctrl+C / Esc). */
export async function confirm(message: string): Promise<boolean> {
  const result = await clackConfirm({ message });
  return isCancel(result) ? false : result;
}

export interface SelectChoice {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

/**
 * Single-choice select over string values. Returns null if the user cancels. Kept to concrete
 * `string` values (not a generic literal union) so clack's conditional Option type resolves;
 * callers that need a narrower type narrow the returned string themselves.
 */
export async function select(message: string, choices: SelectChoice[]): Promise<string | null> {
  const result = await clackSelect<SelectChoice[], string>({ message, options: [...choices] });
  return isCancel(result) ? null : result;
}

/** Free-text input for a discrete prompt (not the main chat line). Returns null if cancelled. */
export async function textInput(message: string, placeholder?: string): Promise<string | null> {
  const result = await clackText({ message, placeholder });
  return isCancel(result) ? null : result;
}
