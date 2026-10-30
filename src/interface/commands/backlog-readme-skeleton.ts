// The backlog/README.md skeleton /new-project writes — the .md-tree format the Breakdown phase fills
// in. A vocabulary constant: it belongs to the document it describes rather than to the one function
// that writes it to disk.

/** Seed doc at backlog/README.md explaining the .md-tree format the Breakdown phase fills in. */
export const BACKLOG_README_SKELETON = `# Backlog

The ordered Task list the execution loop consumes, as a tree of Markdown files (up to three
levels). **Only task files are required** — a task may sit directly here, or under an epic, or
under an epic + story:

\`\`\`
backlog/
  epic-<slug>/          # optional epic folder
    README.md           # epic level documentation (this same shape)
    story-<slug>/       # optional story folder
      README.md         # story level documentation
      01-<slug>.md      # a TASK (required leaf)
  02-<slug>.md          # a task with no epic/story is allowed
\`\`\`

A file named \`README.md\` documents its level and is never a task. Every other \`.md\` is a task
whose **id is its path under \`backlog/\` without \`.md\`** (e.g. \`epic-auth/story-signup/01-add-test\`).

Each task file carries YAML frontmatter + a Markdown body:

\`\`\`markdown
---
status: pending          # pending | in_progress | done | blocked | failed
order: 1                 # global execution sequence (integer)
depends_on: []           # task ids that must be done first, e.g. [epic-auth/story-signup/00-scaffold]
---
# Short task title

What to build, plus any constraints.

## Acceptance
The observable signal of done (e.g. "npm test passes the hashing spec").
\`\`\`
`;
