// Index a list of tool modules by name, refusing a duplicate loudly.
//
// A duplicate name is a build-time mistake, not a runtime condition: two modules answering to
// "read_file" would make which one the model reaches depend on list order. So it throws at module
// evaluation, before a session exists to degrade.
//
// It kept the plain name. src/interface/build-command-registry.ts is the same shape over `Command`
// with a DIFFERENT body -- it was renamed rather than merged, precisely so this one could stay
// `buildRegistry` here.

import type { ToolModule } from './tool-module.type.js';

/** name → module, with a duplicate-name guard (a dup is a build-time mistake, fail loud). */
export function buildRegistry(modules: readonly ToolModule[]): Map<string, ToolModule> {
  const map = new Map<string, ToolModule>();
  for (const module of modules) {
    if (map.has(module.name)) {
      throw new Error(`Duplicate tool name '${module.name}' in the tool registry.`);
    }
    map.set(module.name, module);
  }
  return map;
}
