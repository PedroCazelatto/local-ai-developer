// The three windows a debate runs (run-debate.ts), as the name each one is opened under in memory.db
// (`debate-<window>:spawned`). Its own module because the CALLER implements DebateDeps.openWindow, which
// takes it, while runDebate and distilDebate name the windows they open.

/** The challenger and proponent argue; the digest reads the finished argument and writes the verdict. */
export type DebateWindow = 'challenger' | 'proponent' | 'digest';
