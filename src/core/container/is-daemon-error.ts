// Tells "Docker itself is not reachable" apart from "the command inside the container failed", by
// the only signal the CLI gives: what it wrote to stderr. run_in_project turns the first into a
// stop-and-tell-the-user message so the model does not retry a build that cannot start.

/** Docker daemon / CLI connectivity failure, so the model doesn't retry uselessly. */
export function isDaemonError(stderr: string): boolean {
  return (
    stderr.includes('Cannot connect to the Docker daemon') ||
    stderr.includes('error during connect') ||
    stderr.includes('The system cannot find the file specified') ||
    stderr.includes('docker daemon is not running')
  );
}
