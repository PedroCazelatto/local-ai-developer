// The tool registry (V1/02): a STATIC list of every ToolModule -- explicit imports the build can
// check, never a runtime fs scan -- indexed by name. Registering a tool here makes it AVAILABLE; a
// phase sees it only once its own array in phases/phase-tool-names.ts names it.
//
// This file declares NO function. It is a VALUE module, the way core/llm/daemon.ts and
// interface/command-registry.ts are: the one-function-per-file sweep moved getTool, toolNames,
// toolDefinitions and buildRegistry into their own files, and what is left is the list and the map
// built from it. It survives for that reason alone, not as a re-export shell -- it exports exactly
// one value and re-exports nothing.
//
// TOOL_MODULES stays private because its single consumer is the map on the next line.

import { askSubagentTool } from './ask-subagent.js';
import { askUserTool } from './ask-user.js';
import { buildRegistry } from './build-registry.js'; // indexes by name; throws on a duplicate
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
import type { ToolModule } from './tool-module.type.js';
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

/**
 * name → module, built once with a duplicate-name guard (a dup is a build-time mistake, fail loud).
 *
 * Read it from a FUNCTION BODY only. This directory sits in an import cycle with core/session, so a
 * reader inside this module’s own dependency subtree runs while this binding is still in its temporal
 * dead zone; a top-level `const x = toolRegistry` there throws. get-tool.ts states it in full.
 */
export const toolRegistry: ReadonlyMap<string, ToolModule> = buildRegistry(TOOL_MODULES);
