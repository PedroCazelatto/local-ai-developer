// Look up one registered tool by name.
//
// The read of `toolRegistry` happens INSIDE the function body, which is load-bearing rather than
// stylistic: registry.ts imports all 25 tool modules, and several of them import files under
// core/session/ that import back into this directory. A module reached through such a cycle would be
// evaluated while that map is still in its temporal dead zone, and a top-level read would throw
// `Cannot access 'toolRegistry' before initialization`. A call-time read is always safe, because
// nothing dispatches a tool call before the registry has been built.

import { toolRegistry } from './registry.js';
import type { ToolModule } from './tool-module.type.js';

/** Look up a tool by name; undefined if unknown (the dispatcher turns that into a recoverable error). */
export function getTool(name: string): ToolModule | undefined {
  return toolRegistry.get(name);
}
