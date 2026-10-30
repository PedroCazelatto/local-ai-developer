// Which shape a search_in_files result takes. Folder vocabulary: the request parser validates it, the
// renderer branches on it and the closing notice reports it -- one word spoken by three peers.

// The vocabulary of one search_in_files call, shared by the tool and its five helpers: the validated
// request, the per-file match record the helpers hand each other, the line spans the renderer prints,
// and the outcome the closing notice is written from.
//
// ONE type file for the whole tool rather than one per helper: these types are a single conversation
// about a single search, and a helper that took its own private copy of `LineRange` would be able to
// disagree with the renderer about what a range means.

/** Which shape the result takes: matching lines (the default) or the file list alone. */
export type SearchOutputMode = 'content' | 'paths';
