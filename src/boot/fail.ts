// Boot's unrecoverable exit: name the reason on stderr and stop the process.
//
// It is deliberately NOT one of the three helpers it resembles, and the difference is written down here
// because a later dedupe pass will otherwise reach for it:
//   - errMessage (core/err-message.ts) turns an unknown throw into a string and RETURNS one;
//   - write (core/ui/write.ts) writes a line to STDOUT;
//   - errorLine (core/ui/error-line.ts) is a themed line for a RECOVERABLE error, and it needs a
//     renderer and a theme that do not exist yet at the point in boot where this is called.
// This one writes to stderr, is terminal rather than recoverable, and holds the only process.exit in
// all of src/ — every other one is in scripts/run.mjs, which shares no code with this tree by design.

/** Print `message` to stderr and exit non-zero. Never returns. */
export function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}
