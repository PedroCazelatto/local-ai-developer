// Backlog read/query over a tree of Markdown files under <projectRoot>/backlog/ (the planning
// Breakdown phase WRITES it through the model's write_file tool). The path IS the identity: a
// task's id is its path under backlog/ without ".md". Epic/story folders are optional (only tasks
// are required); a README.md in any folder is that level's documentation, never a task. Reads are
// validated so a malformed frontmatter surfaces a clear typed BacklogError the caller can show +
// hint a rewrite, rather than crashing. setTaskStatus surgically flips one task file's frontmatter
// `status`; nextRunnableTasks gives the execution trigger (V1/10) the eligible tasks in `order`,
// respecting depends_on.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import type { Backlog, Task, TaskStatus } from './types.js';
import { TASK_STATUSES } from './types.js';

/** Typed backlog failure (missing tree, malformed frontmatter, unknown task/status). */
export class BacklogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BacklogError';
  }
}

/** Folder holding the backlog tree, relative to the project root. Committed (not session state). */
export const BACKLOG_DIRNAME = 'backlog';
/** A .md file with this exact name documents its folder's level — it is never treated as a task. */
const LEVEL_DOC = 'README.md';
/** Max relative-path segments for a task: epic / story / task. Deeper nesting is rejected. */
const MAX_DEPTH = 3;

/** Absolute path to the project's backlog/ tree. */
export function backlogRoot(projectPath: string): string {
  return path.join(projectPath, BACKLOG_DIRNAME);
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// --------------------------------------------------------------------------------- frontmatter

interface Frontmatter {
  readonly data: Record<string, unknown>;
  readonly body: string;
}

/** Split leading `---\n...\n---` YAML frontmatter from the Markdown body. No fence -> empty data. */
function splitFrontmatter(text: string, where: string): Frontmatter {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (match === null) return { data: {}, body: text };
  let loaded: unknown;
  try {
    loaded = yaml.load(match[1] ?? '');
  } catch (err) {
    throw new BacklogError(`Task '${where}' has malformed YAML frontmatter: ${msg(err)}. The Breakdown phase should rewrite it.`);
  }
  const data = loaded !== null && typeof loaded === 'object' && !Array.isArray(loaded)
    ? (loaded as Record<string, unknown>)
    : {};
  return { data, body: match[2] ?? '' };
}

// ------------------------------------------------------------------------------ field readers

/** Absent -> `pending` (forgiving of a model that omits it); present-but-invalid -> a loud error. */
function readStatus(raw: unknown, where: string): TaskStatus {
  if (raw === undefined || raw === null) return 'pending';
  if (typeof raw === 'string' && (TASK_STATUSES as readonly string[]).includes(raw)) {
    return raw as TaskStatus;
  }
  throw new BacklogError(`Task '${where}' has status '${String(raw)}' — must be one of ${TASK_STATUSES.join(' | ')}.`);
}

/** frontmatter `order`, else a leading number in the filename (`01-foo` -> 1), else last (∞). */
function readOrder(raw: unknown, filePath: string): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw);
  const prefix = /^(\d+)/.exec(path.basename(filePath));
  return prefix ? Number(prefix[1]) : Number.MAX_SAFE_INTEGER;
}

/** Absent -> []; a string -> a one-element list; an array of strings -> itself; else a loud error. */
function readDependsOn(raw: unknown, where: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (typeof raw === 'string') return raw.trim() === '' ? [] : [raw.trim()];
  if (Array.isArray(raw)) {
    return raw.map((d, i) => {
      if (typeof d !== 'string') {
        throw new BacklogError(`Task '${where}' depends_on[${i}] must be a string task id.`);
      }
      return d.trim();
    });
  }
  throw new BacklogError(`Task '${where}' depends_on must be a string or a list of strings.`);
}

/** First `# Heading` in the body, else a Title-Cased version of the file slug (sans order prefix). */
function deriveTitle(body: string, slug: string): string {
  const h1 = /^#\s+(.+?)\s*$/m.exec(body);
  if (h1 && h1[1]) return h1[1].trim();
  return slug
    .replace(/^\d+[-_]?/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ----------------------------------------------------------------------------------- reading

/** Read one task .md into a Task; derives id/epic/story from its path under backlog/. */
function readTaskFile(root: string, filePath: string): Task {
  const rel = path.relative(root, filePath).split(path.sep).join('/');
  const id = rel.replace(/\.md$/i, '');
  const segments = id.split('/');
  if (segments.length > MAX_DEPTH) {
    throw new BacklogError(`Task '${rel}' is nested too deep — the backlog allows at most epic/story/task (three levels).`);
  }
  const epic = segments.length >= 2 ? (segments[0] ?? null) : null;
  const story = segments.length >= 3 ? (segments[1] ?? null) : null;

  let text: string;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new BacklogError(`Could not read task '${rel}': ${msg(err)}`);
  }
  const { data, body } = splitFrontmatter(text, rel);
  return {
    id,
    filePath,
    title: deriveTitle(body, segments[segments.length - 1] ?? id),
    body: body.trim(),
    dependsOn: readDependsOn(data['depends_on'], rel),
    order: readOrder(data['order'], filePath),
    status: readStatus(data['status'], rel),
    epic,
    story,
  };
}

/** Recursively collect every task file (any .md except README.md) under `dir`. */
function collect(root: string, dir: string, out: Task[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(root, full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name !== LEVEL_DOC) {
      out.push(readTaskFile(root, full));
    }
  }
}

/** Read + validate the whole backlog tree. Throws BacklogError if backlog/ is missing/malformed. */
export function readBacklog(projectPath: string): Backlog {
  const root = backlogRoot(projectPath);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new BacklogError(`No backlog/ directory in the project. Run the Breakdown phase to produce one.`);
  }
  const tasks: Task[] = [];
  collect(root, root, tasks);
  tasks.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { tasks };
}

// ------------------------------------------------------------------------------------- query

/** Every task, sorted by `order` then id (readBacklog already sorts; copy defensively). */
export function allTasks(backlog: Backlog): Task[] {
  return [...backlog.tasks];
}

/** Find one task by id (backlog-relative path without .md), or undefined. */
export function findTask(backlog: Backlog, taskId: string): Task | undefined {
  return backlog.tasks.find((task) => task.id === taskId);
}

/**
 * Tasks eligible to run now — status `pending` AND every `depends_on` id already `done` — sorted by
 * `order`. A dependency that doesn't exist counts as unmet (defense in depth: the trigger trusts
 * `order` for sequence but still skips a task whose deps aren't done).
 */
export function nextRunnableTasks(backlog: Backlog): Task[] {
  const statusById = new Map(backlog.tasks.map((task) => [task.id, task.status]));
  const depsDone = (task: Task): boolean => task.dependsOn.every((depId) => statusById.get(depId) === 'done');
  return backlog.tasks
    .filter((task) => task.status === 'pending' && depsDone(task))
    .sort((a, b) => a.order - b.order);
}

/** README.md bodies documenting the task's epic and story levels (best-effort), for the Worker slice. */
export function levelDocs(projectPath: string, task: Task): { epic: string | null; story: string | null } {
  const root = backlogRoot(projectPath);
  const readDoc = (docPath: string): string | null => {
    if (!existsSync(docPath)) return null;
    try {
      const { body } = splitFrontmatter(readFileSync(docPath, 'utf-8'), docPath);
      const trimmed = body.trim();
      return trimmed === '' ? null : trimmed;
    } catch {
      return null; // a broken level doc must not sink the run — the task body is what matters
    }
  };
  return {
    epic: task.epic ? readDoc(path.join(root, task.epic, LEVEL_DOC)) : null,
    story: task.epic && task.story ? readDoc(path.join(root, task.epic, task.story, LEVEL_DOC)) : null,
  };
}

// ------------------------------------------------------------------------------------- mutate

/** Replace (or insert) the frontmatter `status:` line, preserving the rest of the file verbatim. */
function replaceStatus(text: string, status: TaskStatus): string {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  if ((lines[0] ?? '').trim() !== '---') {
    return `---${nl}status: ${status}${nl}---${nl}${nl}${text}`;
  }
  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if ((lines[i] ?? '').trim() === '---') {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return `---${nl}status: ${status}${nl}---${nl}${nl}${text}`; // unterminated fence: prepend a fresh block
  }
  for (let i = 1; i < close; i += 1) {
    if (/^\s*status\s*:/.test(lines[i] ?? '')) {
      lines[i] = `status: ${status}`;
      return lines.join(nl);
    }
  }
  lines.splice(1, 0, `status: ${status}`); // no status key yet — add it at the top of the block
  return lines.join(nl);
}

/** Flip one task's status in its own .md file. Throws BacklogError if the id isn't in the backlog. */
export function setTaskStatus(projectPath: string, taskId: string, status: TaskStatus): void {
  const filePath = `${path.join(backlogRoot(projectPath), ...taskId.split('/'))}.md`;
  if (!existsSync(filePath)) {
    throw new BacklogError(`Task '${taskId}' not found in the backlog.`);
  }
  let text: string;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new BacklogError(`Could not read task '${taskId}': ${msg(err)}`);
  }
  writeFileSync(filePath, replaceStatus(text, status), 'utf-8');
}
