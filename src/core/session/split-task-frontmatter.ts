// Split a task .md into its YAML frontmatter data and its Markdown body.
//
// Named splitTaskFrontmatter, NOT splitFrontmatter, and the distinction is load-bearing:
// src/context/split-frontmatter.ts already owns that name for a DIFFERENT function — it takes one
// argument, returns `{ name, body }` for a standards file whose frontmatter has already been
// validated elsewhere, and never throws. This one takes the task's path for the error message,
// returns `{ data, body }`, and throws BacklogError on malformed YAML because nothing has validated
// it first. Two functions, one name, in sibling folders is the trap; the name says which is which.

import { load as loadYaml } from 'js-yaml';

import { errMessage } from '../err-message.js';
import { BacklogError } from './backlog-error.js';

interface TaskFrontmatter {
  readonly data: Record<string, unknown>;
  readonly body: string;
}

/** Split leading `---\n...\n---` YAML frontmatter from the Markdown body. No fence -> empty data. */
export function splitTaskFrontmatter(text: string, where: string): TaskFrontmatter {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (match === null) return { data: {}, body: text };
  let loaded: unknown;
  try {
    loaded = loadYaml(match[1] ?? '');
  } catch (err) {
    // errMessage: an Error's message, or the thrown value stringified.
    throw new BacklogError(`Task '${where}' has malformed YAML frontmatter: ${errMessage(err)}. The Breakdown phase should rewrite it.`);
  }
  const data = loaded !== null && typeof loaded === 'object' && !Array.isArray(loaded)
    ? (loaded as Record<string, unknown>)
    : {};
  return { data, body: match[2] ?? '' };
}
