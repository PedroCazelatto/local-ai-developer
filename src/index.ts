// CLI / REPL entry point. It declares nothing of its own: the boot sequence it used to hold lives in
// src/boot/, one function per file. What is left is the process's first line and its last resort.
//
// `import 'dotenv/config'` MUST stay the FIRST import in this file. ESM evaluates a module's imports in
// source order, so being first is exactly what guarantees the whole boot subtree below sees a populated
// process.env — move it down and OLLAMA_NUM_CTX is undefined by the time anything reads it.
import 'dotenv/config';

import { fail } from './boot/fail.js';
import { main } from './boot/main.js';
import { errMessage } from './core/err-message.js';

// main() runs the whole boot sequence and settles only once the REPL has exited. It already exits
// non-zero on every failure it anticipates, so anything that reaches here is unanticipated: name it and
// exit the same way rather than letting Node print an unhandled rejection.
main().catch((err: unknown) => {
  fail(errMessage(err));
});
