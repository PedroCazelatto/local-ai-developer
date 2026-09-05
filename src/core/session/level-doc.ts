// The one file name that is documentation rather than a task. In one place because two readers must
// agree on it exactly: the collector, which must NOT turn it into a task, and the level-doc reader,
// which looks for precisely it. If those two spellings ever drifted, a README would become a task in
// one and vanish from the other.

/** A .md file with this exact name documents its folder's level — it is never treated as a task. */
export const LEVEL_DOC = 'README.md';
