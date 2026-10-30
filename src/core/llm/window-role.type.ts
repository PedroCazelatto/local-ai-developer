// Half of the closed call-role set (see call-role.type.ts for why the set is closed at all). A WINDOW
// holds tools and a history and may stream; that is what separates it from a one-shot, and it is why
// only these roles can be handed a `messages` array that grows.

/**
 * A call that owns a `messages` array and a tool surface: the interactive phases, the three spawned
 * execution windows, and a sub-agent. Every one of these sits at the BASE ceiling — see
 * resolve-window-ctx.ts for why that is structural rather than conventional.
 */
export type WindowRole = 'interactive' | 'worker' | 'reviewer' | 'retro' | 'subagent';
