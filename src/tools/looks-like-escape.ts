// execute_command's `..` check — a COURTESY, not the security control.
//
// The real boundary is the Docker mount: only the active project is mounted at /workspace, so `..`,
// `$(...)`, variables and symlinks land in the empty container OS rather than in another project or
// on the host. This exists so a confused model gets a clean recoverable message instead of wandering
// into an empty filesystem and reasoning from what it finds there.
//
// Deliberately NOT a shell parse. That is impossible to do correctly and unnecessary given the mount,
// and a half-correct parse would be worse than an honest pattern match: it would read as a guarantee.

// Ported from tools/execute_command.py: an obvious `..` escape anywhere the command could form a
// path. Not a full shell parse (impossible + unnecessary — the mount is the real boundary).
const TRAVERSAL_TOKEN = /(?:^|[\s'"=:])\.\.(?:[/\\]|$|[\s'"])/;
const TRAVERSAL_IN_PATH = /[/\\]\.\.(?:[/\\]|$|[\s'"])/;

/** True when a command obviously reaches outside /workspace with a `..` segment. */
export function looksLikeEscape(command: string): boolean {
  return TRAVERSAL_TOKEN.test(command) || TRAVERSAL_IN_PATH.test(command);
}
