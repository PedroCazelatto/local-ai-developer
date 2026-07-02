// SessionMemory — one isolated message history PER phase, with an active pointer (ports
// core/session/memory.py). Switching phases only moves the pointer; histories never leak into one
// another because each phase owns its own array and nothing is ever copied between them.

import type { Message, ToolCall } from '../llm/index.js';

/** Valid chat roles for a stored message. */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

interface AddOptions {
  /** Tool name for a `tool` result message (serialized as Ollama's `tool_name`). */
  readonly toolName?: string;
  /** Structured tool calls for an assistant turn that issued them. */
  readonly toolCalls?: ToolCall[];
}

export class SessionMemory {
  private readonly histories = new Map<string, Message[]>();
  private active: string | null = null;

  /** Point at a phase's history, creating an empty one on first use. */
  setActivePhase(name: string): void {
    this.active = name;
    if (!this.histories.has(name)) {
      this.histories.set(name, []);
    }
  }

  /** Append a message to the ACTIVE phase's history. */
  add(role: ChatRole, content: string, opts?: AddOptions): void {
    const history = this.activeHistory();
    const entry: Message = { role, content };
    if (opts?.toolName) {
      entry.tool_name = opts.toolName;
    }
    if (opts?.toolCalls && opts.toolCalls.length > 0) {
      entry.tool_calls = opts.toolCalls;
    }
    history.push(entry);
  }

  /** Empty the active phase's history (used by V4's /clear; harmless to have now). */
  clear(): void {
    if (this.active !== null) {
      this.histories.set(this.active, []);
    }
  }

  /** The active phase's message array (empty if no phase is active yet). */
  get history(): Message[] {
    if (this.active === null) {
      return [];
    }
    return this.histories.get(this.active) ?? [];
  }

  private activeHistory(): Message[] {
    if (this.active === null) {
      throw new Error('No active phase set');
    }
    const history = this.histories.get(this.active);
    if (history === undefined) {
      throw new Error(`Active phase '${this.active}' has no history array`);
    }
    return history;
  }
}
