// Did a dispatched tool actually fail? The file tools return a structured recoverable error as JSON
// carrying an `error` field (toolError); a plain string is a success, e.g. edit_file's "Edited '...'.".
//
// This is what makes the one-file lock correct: the window locks onto the first file it edits
// SUCCESSFULLY, so a refused edit must not claim the lock and strand the Retro on a file it never
// changed.

/**
 * Detect a structured recoverable error in a dispatched tool's string result (the shape the file tools
 * return via toolError: a JSON object carrying an `error` field). A plain-string result is a success
 * (e.g. edit_file's "Edited '...'."). Used to lock the single-file target ONLY on a real edit.
 */
export function isToolErrorResult(result: string): boolean {
  try {
    const parsed: unknown = JSON.parse(result);
    return typeof parsed === 'object' && parsed !== null && typeof (parsed as Record<string, unknown>)['error'] === 'string';
  } catch {
    return false; // not JSON ⇒ a plain success string
  }
}
