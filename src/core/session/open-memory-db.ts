// Open (creating on first use) a project's phase-memory database. This is the SQLite layer that
// replaced the per-phase JSONL files + archive/ directory: a context is now a row that can be listed,
// titled and reopened, instead of a filename that had to be renamed to change state.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { addCancelledAtColumn } from './add-cancelled-at-column.js';
import { memoryDbFile } from './memory-db-file.js';
import { MEMORY_INDEXES, MEMORY_PRAGMAS, MEMORY_SCHEMA } from './memory-db.schema.js';

/**
 * Open (creating on first use) a project's memory database with the pragmas and schema applied. The
 * caller holds the handle for the session's lifetime; SQLite is opened synchronously, matching every
 * other store here. Pragmas are per-CONNECTION, so they are re-applied on every open — foreign_keys in
 * particular, which SQLite leaves OFF by default.
 */
export function openMemoryDb(projectPath: string): DatabaseSync {
  // memoryDbFile: <projectPath>/.orchestrator/memory.db.
  mkdirSync(path.dirname(memoryDbFile(projectPath)), { recursive: true });
  const db = new DatabaseSync(memoryDbFile(projectPath));
  db.exec(MEMORY_PRAGMAS);
  db.exec(MEMORY_SCHEMA);
  // Between the tables and the indexes on purpose: the partial index reads cancelled_at, which a
  // database written before cancelling existed does not have yet.
  // addCancelledAtColumn: idempotent migration, guarded by PRAGMA table_info.
  addCancelledAtColumn(db);
  db.exec(MEMORY_INDEXES);
  return db;
}
