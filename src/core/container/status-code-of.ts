// dockerode reports a failed Docker HTTP call by throwing, and the only thing that separates the
// cases SandboxClient must tell apart — 404 no such container/path, 304 already stopped, anything
// else a real failure — is the numeric statusCode riding on the thrown value.

/** dockerode/docker HTTP errors carry a numeric statusCode; narrow without asserting `any`. */
export function statusCodeOf(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const code = (err as { statusCode: unknown }).statusCode;
    return typeof code === 'number' ? code : undefined;
  }
  return undefined;
}
