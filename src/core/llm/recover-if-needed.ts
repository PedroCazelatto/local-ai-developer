// The bridge between Ollama's structured tool_calls and the ones this model writes as plain text.
// Both of OllamaClient's paths run a finished message through here, so the streamed turn and the
// non-streamed one cannot drift into disagreeing about whether a call was made.

import type { Message } from 'ollama';

import { recoverToolCalls } from './recover-tool-calls.js';

/**
 * When Ollama returned no structured tool_calls, recover any the model wrote as text and fold
 * them into the message (with the call text stripped from `content`). A no-op when the message
 * already has structured calls or the content holds none.
 */
export function recoverIfNeeded(message: Message): Message {
  if (message.tool_calls && message.tool_calls.length > 0) return message;
  // recoverToolCalls parses <tool_call> tags and bare JSON out of the content and returns both the
  // calls it found and the content with those spans (and any wrapping fence) removed.
  const { cleaned, calls } = recoverToolCalls(message.content);
  if (calls.length === 0) return message;
  return { ...message, content: cleaned, tool_calls: calls };
}
