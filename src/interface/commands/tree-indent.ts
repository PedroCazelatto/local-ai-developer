// The one indent step the task tree draws depth with. A vocabulary constant rather than a property of
// any one function: task-row.ts indents a task by its depth and render-task-tree.ts indents a story
// header under its epic, and the two must move together or the tree stops lining up.

/** Two spaces per level, so an epic/story/task path reads as depth without drawing box glyphs. */
export const TREE_INDENT = '  ';
