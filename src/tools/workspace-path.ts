// Where the active project is bind-mounted inside the sandbox. A constant no function owns — the
// context builder stamps it onto every ToolContext, execute_command runs its shell there, and the
// container-side scope check measures against it — so it gets a file named for the thing itself.
//
// It was declared twice: exported here (as part of the retired context.ts) and again privately in
// resolve-real-workspace-path.ts. Both read this one now; the same path must not be able to be two
// different strings on the two sides of a security check.

/** "/workspace" — where the active project is bind-mounted inside the sandbox (Foundation/04). */
export const WORKSPACE_PATH = '/workspace';
