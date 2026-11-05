// /events — the harness's own actions, the way /audit shows the model's tool calls. Before backlog item
// 19 these rows went to a file nothing read, so a pause for a compaction or an eviction had no in-app
// explanation. A pure read of memory.db's `events` table; the model has no counterpart, like /audit.

import type { Command } from '../command.type.js';
import { showEvents } from './show-events.js';

export const eventsCommand: Command = {
  name: 'events',
  group: 'session',
  description: 'Show the last N harness events (compactions, evictions, cancelled turns, debates, model switches)',
  usage: '/events [<row count>]',
  // showEvents: the last N rows of the events table as a padded table, oldest first, with a recoverable
  // line for a bad count, an absent log, or rows that would not read.
  run: (ctx) => showEvents(ctx.args, ctx.orch),
};
