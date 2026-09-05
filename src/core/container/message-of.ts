// A caught `unknown` turned into the one string a recoverable sandbox result can carry. Every catch
// in SandboxClient answers with a value rather than a throw, and this is what fills its `message`.

/** The message of a thrown value, whatever it turned out to be — never a throw of its own. */
export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
