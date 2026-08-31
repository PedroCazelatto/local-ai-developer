// The one home for "what did this throw say?" — the identical body is declared privately in eleven more
// files today (as `messageOf` in ten of them, `msg` in one) and written inline at ten further call
// sites. It lives at the root of core/ rather than under core/ui/ because it touches no UI: it turns an
// unknown caught value into a string, and the caller decides whether that string becomes a renderer
// line, a tool result or a log row. The one-function-per-file sweep repoints each copy here as it
// reaches that copy's directory; a file still declaring its own has simply not been swept yet.

/** An Error's message, or the thrown value stringified — for reporting a throw of unknown type. */
export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
