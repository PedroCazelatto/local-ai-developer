// The remote every model-facing push targets. Not configurable by the model: git_push takes NO
// arguments — always the checked-out branch, always `origin`, always with `-u`, never a force, never a
// refspec — so there is nothing here for a model to get wrong. In one place because both the presence
// check and the push itself name it, and the model-facing error messages quote it.

/** The remote every push targets. */
export const REMOTE = 'origin';
