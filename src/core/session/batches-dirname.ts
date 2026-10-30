// Where a batch run's summaries live. Git-ignored SESSION state under .orchestrator/, one JSON file
// per batch -- not project history. In one place because three readers share it: the sequence counter,
// the writer, and the REPL line that tells the user where the summary was saved.

/** Folder under .orchestrator/ holding one JSON file per batch (git-ignored session state). */
export const BATCHES_DIRNAME = 'batches';
