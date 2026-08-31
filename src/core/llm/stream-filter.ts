// Strip tool-call mechanics from a streamed delta sequence so the UI shows prose only.
// Port of core/llm/stream_filter.py. Detects three shapes the model sometimes emits as plain
// text instead of structured tool_calls:
//
//   - `<tool_call> ... </tool_call>` tag-wrapped blocks.
//   - Bare top-level JSON objects whose keys include `name`, `function_name`, or `tool`
//     (the qwen2.5-coder bare-emission patterns).
//   - The same JSON wrapped in a ```json ... ``` fence (fence included).
//
// Non-tool-call JSON (e.g. a snippet the model quotes in prose) is held while the braces
// balance, then emitted in one chunk; likewise for fenced JSON. Display-only: the structured
// message.tool_calls is captured separately and is unaffected by filtering.

import { isAlnum } from './is-alnum.js';
import { isRecord } from './is-record.js';
import { loadsOrRepair } from './loads-or-repair.js';

type FilterMode =
  | 'prose'
  | 'tag'
  | 'json'
  | 'fence_open'
  | 'fence_body'
  | 'fence_json'
  | 'fence_close';

const NAME_KEYS = ['name', 'function_name', 'tool'] as const;
const TAG_OPEN = '<tool_call>';
const TAG_CLOSE = '</tool_call>';
const FENCE_LANG_CHARS = '_-+.';
const WHITESPACE = ' \t\r\n';

export class StreamFilter {
  private mode: FilterMode = 'prose';
  private pending = '';
  private depth = 0;
  private inString = false;
  private escape = false;
  private jsonStart = 0;
  private jsonEnd = 0;

  /** Feed a raw delta; returns the visible (filtered) prose to display, possibly empty. */
  push(delta: string): string {
    const out: string[] = [];
    for (const ch of delta) {
      switch (this.mode) {
        case 'prose':
          this.handleProse(ch, out);
          break;
        case 'tag':
          this.pending += ch;
          if (this.pending.endsWith(TAG_CLOSE)) {
            this.pending = '';
            this.mode = 'prose';
          }
          break;
        case 'json':
          this.pending += ch;
          this.advanceJson(ch);
          if (this.depth === 0) this.closeJson(out);
          break;
        case 'fence_open':
          this.handleFenceOpen(ch, out);
          break;
        case 'fence_body':
          this.handleFenceBody(ch, out);
          break;
        case 'fence_json':
          this.pending += ch;
          this.advanceJson(ch);
          if (this.depth === 0) {
            this.jsonEnd = this.pending.length;
            this.mode = 'fence_close';
          }
          break;
        case 'fence_close':
          this.handleFenceClose(ch, out);
          break;
      }
    }
    return out.join('');
  }

  /**
   * End-of-stream tail. Returns any held prose; drops partial tool-call buffers. A complete
   * fenced JSON that is NOT a tool call is returned.
   */
  flush(): string {
    const { pending, mode } = this;
    this.pending = '';
    this.mode = 'prose';
    if (mode === 'prose') return pending;
    if (mode === 'fence_close' && !this.isToolCall(pending.slice(this.jsonStart, this.jsonEnd))) {
      return pending;
    }
    return '';
  }

  private handleProse(ch: string, out: string[]): void {
    if (this.pending.startsWith('<')) {
      const candidate = this.pending + ch;
      if (candidate === TAG_OPEN) {
        this.mode = 'tag';
        this.pending = '';
        return;
      }
      if (TAG_OPEN.startsWith(candidate)) {
        this.pending = candidate;
        return;
      }
      out.push(this.pending);
      this.pending = '';
      this.handleProseFresh(ch, out);
      return;
    }
    this.handleProseFresh(ch, out);
  }

  private handleProseFresh(ch: string, out: string[]): void {
    if (ch === '<') {
      this.pending = '<';
      return;
    }
    if (ch === '{') {
      this.mode = 'json';
      this.pending = '{';
      this.resetJsonTracking();
      return;
    }
    if (ch === '`') {
      this.mode = 'fence_open';
      this.pending = '`';
      return;
    }
    out.push(ch);
  }

  // ------------------------------------------------------------------ fences

  /** Accumulating ``` + optional language tag, until the newline. */
  private handleFenceOpen(ch: string, out: string[]): void {
    const onlyTicks = this.pending.replace(/^`+|`+$/g, '') === '';
    if (ch === '`') {
      if (onlyTicks && this.pending.length < 3) {
        this.pending += ch;
        return;
      }
      this.abortFence(ch, out);
      return;
    }
    if (onlyTicks && this.pending.length < 3) {
      // one or two backticks: inline code, not a fence
      this.abortFence(ch, out);
      return;
    }
    if (ch === '\n') {
      this.pending += ch;
      this.mode = 'fence_body';
      return;
    }
    if (isAlnum(ch) || FENCE_LANG_CHARS.includes(ch)) {
      this.pending += ch;
      return;
    }
    this.abortFence(ch, out);
  }

  /** Inside the fence, before the first non-whitespace character. */
  private handleFenceBody(ch: string, out: string[]): void {
    if (WHITESPACE.includes(ch)) {
      this.pending += ch;
      return;
    }
    if (ch === '{') {
      this.jsonStart = this.pending.length;
      this.pending += ch;
      this.resetJsonTracking();
      this.mode = 'fence_json';
      return;
    }
    // fence body isn't JSON — stream it normally
    this.abortFence(ch, out);
  }

  /** JSON balanced; expecting optional whitespace then the closing ```. */
  private handleFenceClose(ch: string, out: string[]): void {
    if (WHITESPACE.includes(ch) && !this.pending.endsWith('`')) {
      this.pending += ch;
      return;
    }
    if (ch === '`') {
      this.pending += ch;
      if (this.pending.endsWith('```')) {
        if (!this.isToolCall(this.pending.slice(this.jsonStart, this.jsonEnd))) {
          out.push(this.pending);
        }
        this.pending = '';
        this.mode = 'prose';
      }
      return;
    }
    this.abortFence(ch, out);
  }

  /** Held text turned out not to be a tool-call fence: emit and resume prose. */
  private abortFence(ch: string, out: string[]): void {
    out.push(this.pending);
    this.pending = '';
    this.mode = 'prose';
    this.handleProseFresh(ch, out);
  }

  // -------------------------------------------------------------------- json

  private resetJsonTracking(): void {
    this.depth = 1;
    this.inString = false;
    this.escape = false;
  }

  private advanceJson(ch: string): void {
    if (this.escape) {
      this.escape = false;
      return;
    }
    if (this.inString) {
      if (ch === '\\') {
        this.escape = true;
      } else if (ch === '"') {
        this.inString = false;
      }
      return;
    }
    if (ch === '"') {
      this.inString = true;
    } else if (ch === '{') {
      this.depth += 1;
    } else if (ch === '}') {
      this.depth -= 1;
    }
  }

  private closeJson(out: string[]): void {
    if (!this.isToolCall(this.pending)) {
      out.push(this.pending);
    }
    this.pending = '';
    this.mode = 'prose';
  }

  private isToolCall(text: string): boolean {
    // loadsOrRepair: JSON.parse, falling back to a pass that escapes the literal control characters
    // qwen writes inside strings. isRecord rejects null and arrays before the `in` probes below.
    const obj = loadsOrRepair(text);
    return isRecord(obj) && NAME_KEYS.some((k) => k in obj);
  }
}
