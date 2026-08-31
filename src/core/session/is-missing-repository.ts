// Telling "the remote branch is not there yet" (fine — `-u` creates it) apart from "the REPOSITORY is
// not there" (an error the model cannot fix). That asymmetry is the whole point of the push tool: the
// model never creates a GitHub repository, so a push with no destination has to come back as a
// recoverable message telling it to ask the user.

/**
 * git's several ways of saying "that repository is not there". HTTPS answers "Repository not found",
 * SSH answers "Could not read from remote repository" after the host rejects it, and a bad path
 * answers "does not appear to be a git repository". All three mean the same thing to the model: the
 * destination does not exist and a human has to create it.
 */
export function isMissingRepository(stderr: string): boolean {
  const text = stderr.toLowerCase();
  return (
    text.includes('repository not found') ||
    text.includes('does not appear to be a git repository') ||
    text.includes('could not read from remote repository')
  );
}
