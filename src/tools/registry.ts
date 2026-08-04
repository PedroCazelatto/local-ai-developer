// Tool registry (V1/02). A STATIC list of every ToolModule (explicit imports the build can check —
// no runtime fs scan). Duplicate names are rejected loudly at load. `toolDefinitions()` builds the
// FULL Ollama `tools` array, which is no longer handed to a phase as-is: phases/phase-tool-names.ts
// holds one allowlist per phase and phases/resolve-phase-tools.ts narrows this set down to it.
// Registering a tool here makes it AVAILABLE; a phase sees it only once its own array names it.

import type { Tool } from '../core/llm/index.js';
import { askSubagentTool } from './ask-subagent.js';
import { askUserTool } from './ask-user.js';
import { commitChangesTool } from './commit-changes.js';
import { debateTool } from './debate.js';
import { dismissSubagentTool } from './dismiss-subagent.js';
import { editFileTool } from './edit-file.js';
import { executeCommandTool } from './execute-command.js';
import { gitBranchTool } from './git-branch.js';
import { gitInspectTool } from './git-inspect.js';
import { gitPushTool } from './git-push.js';
import { gitStashTool } from './git-stash.js';
import { inboxPostTool } from './inbox-post.js';
import { inboxReadTool } from './inbox-read.js';
import { inboxResolveTool } from './inbox-resolve.js';
import { listChangesTool } from './list-changes.js';
import { listFilesTool } from './list-files.js';
import { loadRuleTool } from './load-rule.js';
import { readFileTool } from './read-file.js';
import { runInProjectTool } from './run-in-project.js';
import { searchInFilesTool } from './search-in-files.js';
import { searchRulesTool } from './search-rules.js';
import { spawnSubagentTool } from './spawn-subagent.js';
import type { ToolModule } from './types.js';
import { writeFileTool } from './write-file.js';

// The static module list — every tool the model can call. New tools append here and are picked up
// everywhere automatically.
const TOOL_MODULES: readonly ToolModule[] = [
  listFilesTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  searchInFilesTool,
  executeCommandTool,
  runInProjectTool,
  // Project git — see the uncommitted set, then commit exactly what you name, with the message written
  // by a throwaway one-shot context. Registered globally so every phase can commit its own approved
  // work; the Worker window strips commit_changes out (it hands everything to the Reviewer instead).
  listChangesTool,
  commitChangesTool,
  // The rest of git, one tool per operation group. Registered globally; phase-tool-names.ts decides
  // who gets what. git_inspect is read-only and goes to every phase; git_stash and git_push are
  // withheld from the Worker (it must not be able to hide the work the Reviewer judges, and it has no
  // commits of its own to publish), while git_branch is how it puts itself on the task's branch.
  gitStashTool,
  gitInspectTool,
  gitBranchTool,
  gitPushTool,
  // Cross-phase inbox (V3/04) — the AGENT_NOTES.md replacement; global (every phase reads/posts).
  inboxReadTool,
  inboxPostTool,
  inboxResolveTool,
  // On-demand standards retrieval (V4/02) — global; every phase (and the Worker/Reviewer windows) can
  // resolve an intent to a standard name and load that one body without the catalog entering context.
  searchRulesTool,
  loadRuleTool,
  // Sub-agents (V5/01) — spawn/ask/dismiss a fresh-context worker. Registered globally so the
  // interactive phases advertise them; the orchestrator backs them with the SubagentManager and does
  // NOT pass them to the spawned execution windows (Worker/Reviewer/Retro), which have no manager.
  spawnSubagentTool,
  askSubagentTool,
  dismissSubagentTool,
  // Model-to-model deliberation — a bounded challenger/proponent argument over the claim the caller is
  // about to commit to, distilled to one digest. Registered globally; it needs no SubagentManager (it
  // runs on the same throwaway one-shot device as search_rules), so unlike the sub-agent tools it can be
  // handed to a spawned window — which is why the Reviewer and Retro get it.
  debateTool,
  // Interactive questioning (V6/01) — a round of multiple-choice questions put straight to the user.
  // Registered globally so the interactive phases advertise it; the orchestrator does NOT pass it to
  // the spawned execution windows (Worker/Reviewer/Retro), which run unattended and would stall a
  // batch waiting on a keypress. Those escalate via the Reviewer's raise_blocker instead.
  askUserTool,
];

/** name → module, built once with a duplicate-name guard (a dup is a build-time mistake, fail loud). */
const REGISTRY: ReadonlyMap<string, ToolModule> = buildRegistry(TOOL_MODULES);

function buildRegistry(modules: readonly ToolModule[]): Map<string, ToolModule> {
  const map = new Map<string, ToolModule>();
  for (const module of modules) {
    if (map.has(module.name)) {
      throw new Error(`Duplicate tool name '${module.name}' in the tool registry.`);
    }
    map.set(module.name, module);
  }
  return map;
}

/** Look up a tool by name; undefined if unknown (the dispatcher turns that into a recoverable error). */
export function getTool(name: string): ToolModule | undefined {
  return REGISTRY.get(name);
}

/** Every registered tool name (used for the unknown-tool error's `available` list). */
export function toolNames(): string[] {
  return [...REGISTRY.keys()];
}

/**
 * Build the Ollama `tools` array from the registry: one function entry per module. Sent on every
 * call for every phase. The `parameters` schema is structurally the JSON-schema Ollama expects.
 */
export function toolDefinitions(): Tool[] {
  return [...REGISTRY.values()].map((module) => ({
    type: 'function',
    function: {
      name: module.name,
      description: module.description,
      parameters: {
        type: module.parameters.type,
        properties: module.parameters.properties,
        // Copy the readonly required list into a fresh mutable array for Ollama's Tool type.
        ...(module.parameters.required ? { required: [...module.parameters.required] } : {}),
      },
    },
  }));
}
