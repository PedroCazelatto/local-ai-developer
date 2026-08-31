// A single-choice list through @clack/prompts — batch selection and the like ("run one / some / all
// tasks"). clack's cancel symbol is mapped to null here so no caller has to import `isCancel` itself.

import { select as clackSelect, isCancel } from '@clack/prompts';

/** One row of the list: the value returned, the label shown, and an optional dim hint beside it. */
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
