// The set is CLOSED, and that is the point: every model call in this repo is one of these eleven, so
// "which ceiling does this call get?" has exactly one answer per role and a mistyped role is a compile
// error rather than a silent fall-through to the base. It is the same guarantee phase-tool-names.ts
// gets from its arrays -- policy as data, in one readable place -- obtained here from the type system,
// since the values are resolved at every call rather than once per phase.
//
// The split into two halves is not decoration. A WINDOW holds tools and a history and streams; a
// ONE-SHOT holds neither and is discarded when it answers (docs/mental-model.md). Only a window may
// stream, and only a one-shot may be handed to `oneShot`, so the two sub-unions are what stop a
// one-shot claiming to be a Worker and quietly taking the Worker's ceiling.
//
// A union in one file importing its members from others is the expected shape under one type per
// file; nothing about the rule argues for keeping a family together in one module.

import type { OneShotRole } from './one-shot-role.type.js';
import type { WindowRole } from './window-role.type.js';

/** Every model call this orchestrator makes, window and one-shot alike. */
export type CallRole = WindowRole | OneShotRole;
