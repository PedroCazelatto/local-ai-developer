/**
 * Resolves with `pending`, or rejects as soon as `signal` aborts, whichever comes first.
 *
 * A streaming chat call has no iterator to abort until the HTTP response opens, so a cancel that lands
 * during that wait would otherwise sit unheard. If the request opens later anyway, it is aborted on
 * arrival so the connection does not stay open.
 */
export function awaitOrAbort<T extends { abort(): void }>(
  pending: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      pending.then(
        (it) => it.abort(),
        () => {},
      );
      reject(new Error('cancelled before the first byte'));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });

    pending.then(
      (it) => {
        signal.removeEventListener('abort', onAbort);
        resolve(it);
      },
      (err: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}
