// Strict UTF-8 decoding for the file tools. Strict on purpose: a binary file silently decoded with
// replacement characters would be handed to the model as text it could then "edit", and the write
// would corrupt the original. A throw is what lets each tool say "is not valid UTF-8 text" instead.

/**
 * Decode bytes as strict UTF-8. Throws a TypeError on an invalid sequence — the file tools map that
 * to their "is not valid UTF-8 text" error (matching the Python UnicodeDecodeError branch).
 */
export function decodeUtf8Strict(buffer: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
}
