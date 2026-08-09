// Wrap a value as a single shell argument for `sh -c`. Single quotes suspend every expansion sh
// performs — $, `, \, *, whitespace — so the only character needing care is the quote itself, closed
// and re-opened around an escaped one (`'\''`).
//
// This is for the tools that BUILD a command out of a model-supplied value (list_files' directory,
// search_in_files' pattern and glob). It is not a security control — the Docker mount is, and
// execute_command hands its whole string to the shell unquoted by design. It is what stops a path
// containing a space or an apostrophe from being read as two arguments.

export function quoteShellArgument(value: string): string {
  return `'${value.split("'").join("'\\''")}'`;
}
