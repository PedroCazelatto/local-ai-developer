import { renderer } from '../core/ui/renderer.js';
import { theme } from '../core/ui/theme.js';
import type { ExitGuard } from './exit-guard.type.js';

/** How long (ms) the second Ctrl+C has to arrive after the first. */
const EXIT_CONFIRM_MS = 3000;

/**
 * Idle Ctrl+C asks for confirmation instead of quitting: the first press says so in the scrollback and
 * opens a short window, and a second press inside it calls `onExit`. When the window lapses the guard
 * silently goes back to unarmed, so a press later on starts over.
 */
export function createExitGuard(onExit: () => void, windowMs: number = EXIT_CONFIRM_MS): ExitGuard {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const disarm = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const press = (): void => {
    if (timer !== null) {
      disarm();
      onExit();
      return;
    }
    renderer.interjectLine(theme.meta(`Press Ctrl+C again within ${windowMs / 1000} seconds to exit`));
    timer = setTimeout(() => {
      timer = null;
    }, windowMs);
  };

  return { press, disarm };
}
