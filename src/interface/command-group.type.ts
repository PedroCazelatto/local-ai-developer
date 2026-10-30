// The purpose buckets /help groups commands under. A closed union, owned by no function: `Command`
// carries it as a field and commands/help.ts reads it to build the display, but nothing produces one.

/** The purpose buckets `/help` groups commands under. The display order/labels live in commands/help.ts. */
export type CommandGroup = 'session' | 'models' | 'projects' | 'subagents' | 'execution';
