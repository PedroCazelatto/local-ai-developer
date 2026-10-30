// A tool call's exit status, as the /audit listing prints it. Split out of format-audit-row.ts, where
// it was private and called `exit` — a name that could not survive extraction at all: exit.ts in this
// same folder is the /exit COMMAND. The collision is what forced the rename, and `exitLabel` is the
// better name anyway, for the reason duration-label.ts gives.

/** `exit 0` / `exit -1` (dispatch's "any failure") / `exit ?` when the row carried no status. */
export function exitLabel(status: number | null): string {
  return status === null ? 'exit ?' : `exit ${status}`;
}
