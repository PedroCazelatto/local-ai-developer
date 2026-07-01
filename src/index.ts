// CLI / REPL entry point.
//
// Foundation task 02 fills in argv parsing and full session boot. For now this is a
// placeholder that proves the ESM / NodeNext toolchain executes TypeScript directly
// (via `tsx` for the dev loop, `tsc`-built output under dist/ for production).

const project = process.argv[2];

if (project === undefined) {
  console.error("Usage: run start <project>");
  process.exit(1);
}

console.log(`local-ai-developer — TypeScript skeleton online. Active project: ${project}`);
