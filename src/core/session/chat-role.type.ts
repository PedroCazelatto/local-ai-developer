// The chat roles a stored message can replay under.
//
// It has its own module rather than sitting beside toMessageRole because the FUNCTION that maps a
// stored role to a chat role does not return this type — it returns Ollama's `Message['role']`, which
// is the shape the client actually needs. Nothing in the memory store consumes ChatRole; it is part of
// core/session's published vocabulary, which is exactly the case the one-type-per-file rule covers.
//
// The stem is also why to-message-role.ts is not called chat-role.ts: a `.type.ts` may not share a
// stem with a `.ts`, and the exported NAME outranks the private helper's.

/** Valid chat roles for a stored message. */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';
