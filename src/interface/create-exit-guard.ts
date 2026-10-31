import type { ExitGuard } from './exit-guard.type.js';

/** How long (ms) the second Ctrl+C has to arrive after the first. */
const EXIT_CONFIRM_MS = 3000;

export interface ExitGuardOptions {
  /** Called on the confirming second press. */
  onExit: () => void;
  /** Put the hint where the user sees it. Must not add a line to the scrollback. */
  show: (text: string) => void;
  /** Take the hint away again. */
  hide: () => void;
  windowMs?: number;
}

/**
 * Idle Ctrl+C asks for confirmation instead of quitting: the first press shows a hint and opens a short
 * window, and a second press inside it calls `onExit`. When the window lapses (or any other key is
 * pressed) the hint is hidden and the guard goes back to unarmed.
 */
export function createExitGuard(opts: ExitGuardOptions): ExitGuard {
  const windowMs = opts.windowMs ?? EXIT_CONFIRM_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const disarm = (): void => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    opts.hide();
  };

  const press = (): void => {
    if (timer !== null) {
      disarm();
      opts.onExit();
      return;
    }
    opts.show(`Press Ctrl+C again to exit`);
    timer = setTimeout(() => {
      timer = null;
      opts.hide();
    }, windowMs);
  };

  return { press, disarm };
}
