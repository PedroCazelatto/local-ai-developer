// Backlog read/write/query (V1/09). The orchestrator reads .orchestrator/backlog.json host-side
// (the planning phases WRITE it through the model's write_file tool); reads are validated so a
// malformed file surfaces a clear typed BacklogError the caller can show + hint a rewrite, rather
// than crashing. setTaskStatus flips one task's status; nextRunnableTasks gives the execution
// trigger (V1/10) the eligible tasks in `order`, respecting depends_on.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Backlog, Epic, Story, Task, TaskStatus } from './types.js';
import { TASK_STATUSES } from './types.js';

/** Typed backlog failure (missing file, malformed JSON, bad shape, unknown task/status). */
export class BacklogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BacklogError';
  }
}

function backlogPath(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'backlog.json');
}

// ------------------------------------------------------------------------------------- validation

function fail(where: string, expected: string): never {
  throw new BacklogError(`Invalid backlog: ${where} must be ${expected}.`);
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(where, 'an object');
  return value as Record<string, unknown>;
}

function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) fail(where, 'an array');
  return value;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string') fail(where, 'a string');
  return value;
}

function asNumber(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(where, 'a number');
  return value;
}

function asStatus(value: unknown, where: string): TaskStatus {
  if (typeof value !== 'string' || !(TASK_STATUSES as readonly string[]).includes(value)) {
    fail(where, `one of ${TASK_STATUSES.join(' | ')}`);
  }
  return value as TaskStatus;
}

function parseTask(raw: unknown, where: string): Task {
  const t = asRecord(raw, where);
  const dependsOn = asArray(t['depends_on'] ?? [], `${where}.depends_on`).map((d, i) =>
    asString(d, `${where}.depends_on[${i}]`),
  );
  return {
    id: asString(t['id'], `${where}.id`),
    title: asString(t['title'], `${where}.title`),
    description: asString(t['description'], `${where}.description`),
    acceptance: asString(t['acceptance'], `${where}.acceptance`),
    depends_on: dependsOn,
    order: asNumber(t['order'], `${where}.order`),
    status: asStatus(t['status'], `${where}.status`),
  };
}

function parseStory(raw: unknown, where: string): Story {
  const s = asRecord(raw, where);
  return {
    id: asString(s['id'], `${where}.id`),
    title: asString(s['title'], `${where}.title`),
    tasks: asArray(s['tasks'], `${where}.tasks`).map((t, i) => parseTask(t, `${where}.tasks[${i}]`)),
  };
}

function parseEpic(raw: unknown, where: string): Epic {
  const e = asRecord(raw, where);
  return {
    id: asString(e['id'], `${where}.id`),
    title: asString(e['title'], `${where}.title`),
    stories: asArray(e['stories'], `${where}.stories`).map((s, i) => parseStory(s, `${where}.stories[${i}]`)),
  };
}

/** Validate an unknown parsed value into a Backlog, or throw BacklogError naming the bad field. */
export function parseBacklog(raw: unknown): Backlog {
  const root = asRecord(raw, 'root');
  return {
    version: asNumber(root['version'], 'version'),
    epics: asArray(root['epics'], 'epics').map((e, i) => parseEpic(e, `epics[${i}]`)),
  };
}

// -------------------------------------------------------------------------------------- read/write

/** Read + validate .orchestrator/backlog.json. Throws BacklogError on a missing/malformed file. */
export function readBacklog(projectPath: string): Backlog {
  const file = backlogPath(projectPath);
  if (!existsSync(file)) {
    throw new BacklogError(
      `No backlog at .orchestrator/backlog.json. Run the Breakdown phase to produce one.`,
    );
  }
  let text: string;
  try {
    text = readFileSync(file, 'utf-8');
  } catch (err) {
    throw new BacklogError(`Could not read backlog.json: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new BacklogError(
      `backlog.json is not valid JSON (${err instanceof Error ? err.message : String(err)}). The Breakdown phase should rewrite it.`,
    );
  }
  return parseBacklog(parsed);
}

/** Write the backlog as pretty JSON to .orchestrator/backlog.json (creating .orchestrator/). */
export function writeBacklog(projectPath: string, backlog: Backlog): void {
  const file = backlogPath(projectPath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(backlog, null, 2)}\n`, 'utf-8');
}

// ------------------------------------------------------------------------------------------ query

/** Every task across all epics/stories, in document order (not execution order). */
export function allTasks(backlog: Backlog): Task[] {
  return backlog.epics.flatMap((epic) => epic.stories.flatMap((story) => story.tasks.map((task) => task)));
}

/** Find one task by id, or undefined. */
export function findTask(backlog: Backlog, taskId: string): Task | undefined {
  return allTasks(backlog).find((task) => task.id === taskId);
}

/**
 * Tasks eligible to run now — status `pending` AND every `depends_on` id already `done` — sorted by
 * `order`. A dependency that doesn't exist counts as unmet (defense in depth: the trigger trusts
 * `order` for sequence but still skips a task whose deps aren't done).
 */
export function nextRunnableTasks(backlog: Backlog): Task[] {
  const statusById = new Map(allTasks(backlog).map((task) => [task.id, task.status]));
  const depsDone = (task: Task): boolean =>
    task.depends_on.every((depId) => statusById.get(depId) === 'done');
  return allTasks(backlog)
    .filter((task) => task.status === 'pending' && depsDone(task))
    .sort((a, b) => a.order - b.order);
}

/** Flip one task's status and persist. Throws BacklogError if the id isn't in the backlog. */
export function setTaskStatus(projectPath: string, taskId: string, status: TaskStatus): void {
  const backlog = readBacklog(projectPath);
  let found = false;
  const updated: Backlog = {
    version: backlog.version,
    epics: backlog.epics.map((epic) => ({
      ...epic,
      stories: epic.stories.map((story) => ({
        ...story,
        tasks: story.tasks.map((task) => {
          if (task.id !== taskId) return task;
          found = true;
          return { ...task, status };
        }),
      })),
    })),
  };
  if (!found) {
    throw new BacklogError(`Task '${taskId}' not found in the backlog.`);
  }
  writeBacklog(projectPath, updated);
}
