// Pins StreamFilter, one of the two places a model's malformed output is parsed. It is a character
// state machine over a streamed delta sequence, so the property that matters most is not any single
// case: it is that the ANSWER DOES NOT DEPEND ON WHERE THE CHUNKS FALL. Ollama splits a reply at
// arbitrary token boundaries, so a filter that only works on whole strings is a filter that works
// in tests and leaks tool-call JSON into the terminal in production.
//
// Every case below therefore runs twice — once as a single push, once one character at a time — and
// asserts BOTH against the same stated literal. Asserting the two runs equal each other alone would
// be a self-comparison and could pass with both equally wrong.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { StreamFilter } from '../stream-filter.js';

/** Feed `chunks` in order and append the flush tail — the whole visible output of a stream. */
function feed(chunks: readonly string[]): string {
  const filter = new StreamFilter();
  return chunks.map((chunk) => filter.push(chunk)).join('') + filter.flush();
}

/** Assert `input` filters to `expected` whether it arrives whole or one character at a time. */
function filters(input: string, expected: string): void {
  assert.equal(feed([input]), expected, 'as one chunk');
  assert.equal(feed([...input]), expected, 'one character per chunk');
}

// ======================================================================================= prose

test('plain prose passes straight through', () => {
  filters('hello world', 'hello world');
});

test('the empty stream produces nothing', () => {
  filters('', '');
});

test('markdown that is not a fence or a brace is untouched', () => {
  filters('# Heading\n\n- a list\n- of items\n', '# Heading\n\n- a list\n- of items\n');
});

// ============================================================================== <tool_call> tags

test('a tagged tool call is stripped entirely', () => {
  filters('<tool_call>{"name":"read_file","arguments":{"path":"a.ts"}}</tool_call>', '');
});

test('prose on either side of a tagged call survives', () => {
  filters('before <tool_call>{"name":"x"}</tool_call> after', 'before  after');
});

test('the tag alone strips the block — its payload is never inspected', () => {
  // Inside a tag there is nothing to decide: the model has already declared what the block is.
  filters('<tool_call>not json at all</tool_call>', '');
});

test('an angle bracket that is not the tag is emitted', () => {
  filters('<div>text</div>', '<div>text</div>');
});

test('a prefix of the tag that then diverges is emitted in full', () => {
  filters('<tool_x', '<tool_x');
  filters('<too', '<too');
});

test('a less-than immediately followed by another less-than is emitted', () => {
  filters('a << b', 'a << b');
});

// ================================================================================== bare JSON

test('a bare top-level JSON tool call is stripped', () => {
  filters('{"name":"read_file","arguments":{"path":"a.ts"}}', '');
});

test('each of the three name keys marks an object as a tool call', () => {
  for (const key of ['name', 'function_name', 'tool']) {
    filters(`{"${key}":"read_file"}`, '');
  }
});

test('JSON with no name key is held while the braces balance, then emitted whole', () => {
  filters('{"a":1,"b":[2,3]}', '{"a":1,"b":[2,3]}');
});

test('nested braces inside a tool call are counted, not treated as the end', () => {
  filters('{"name":"x","arguments":{"nested":{"deep":1}}}', '');
});

test('a brace inside a JSON string does not end the object early', () => {
  filters('{"a":"}"}', '{"a":"}"}');
});

test('an escaped quote inside a string does not end the string early', () => {
  filters('{"a":"say \\"hi\\" }"}', '{"a":"say \\"hi\\" }"}');
});

test('prose around a bare call keeps the whitespace on both sides', () => {
  filters('Hi {"name":"x"} bye', 'Hi  bye');
});

test('literal control characters inside a tool call are repaired, and it is still stripped', () => {
  // The classic qwen fault: a real newline inside a JSON string value. JSON.parse rejects it, so
  // without the repair pass the call would be shown to the user as raw JSON.
  filters('{"name":"write_file","arguments":{"content":"line1\nline2"}}', '');
});

test('literal control characters in NON-tool JSON are still emitted verbatim', () => {
  const json = '{"content":"line1\nline2"}';
  filters(json, json);
});

// ==================================================================================== fences

test('a fenced tool call is stripped together with its fence', () => {
  filters('```json\n{"name":"x"}\n```', '');
});

test('a fenced non-tool object is emitted together with its fence', () => {
  const fenced = '```json\n{"a":1}\n```';
  filters(fenced, fenced);
});

test('a fence with no language tag works the same way', () => {
  filters('```\n{"name":"x"}\n```', '');
});

test('a fence whose body is not JSON is streamed normally', () => {
  // Followed by prose, so the closing fence is re-read as an opener and aborted back into prose.
  const fenced = '```ts\nconst a = 1;\n```\ndone';
  filters(fenced, fenced);
});

test('a reply ENDING in a fenced code block loses its closing fence', () => {
  // CURRENT BEHAVIOUR, and the most consequential defect found in this file. flush() returns held
  // text only in `prose` and `fence_close` modes; a closing ``` sits in `fence_open` and is dropped.
  // The system prompt tells the model to use a fenced block for code, so a reply that ends with one
  // is the ordinary case — and the user is shown an unterminated code block. See the report.
  filters('```ts\nconst a = 1;\n```', '```ts\nconst a = 1;\n');
});

test('a trailing newline after that closing fence is lost with it', () => {
  filters('```ts\nconst a = 1;\n```\n', '```ts\nconst a = 1;\n');
});

test('a fence opener alone at end of stream is lost entirely', () => {
  filters('```ts\n', '');
});

test('one or two backticks are inline code, not a fence', () => {
  filters('use `code` here', 'use `code` here');
});

test('prose after a stripped fence resumes normally', () => {
  filters('```json\n{"name":"x"}\n```\ndone', '\ndone');
});

// ======================================================================================= flush

test('flush returns prose still held at end of stream', () => {
  const filter = new StreamFilter();
  assert.equal(filter.push('a<'), 'a');
  assert.equal(filter.flush(), '<');
});

test('flush DROPS a partial tagged call rather than leaking it', () => {
  const filter = new StreamFilter();
  assert.equal(filter.push('<tool_call>{"name":"x"'), '');
  assert.equal(filter.flush(), '');
});

test('flush DROPS an unterminated bare object, tool call or not', () => {
  // The stream ended mid-object, so nothing can decide what it was; leaking half an object into the
  // terminal is worse than losing it. Pinned as CURRENT behaviour.
  const filter = new StreamFilter();
  assert.equal(filter.push('{"a":1'), '');
  assert.equal(filter.flush(), '');
});

test('flush returns a COMPLETE fenced non-tool object waiting on its closing ticks', () => {
  const filter = new StreamFilter();
  assert.equal(filter.push('```json\n{"a":1}'), '');
  assert.equal(filter.flush(), '```json\n{"a":1}');
});

test('flush drops a complete fenced TOOL call waiting on its closing ticks', () => {
  const filter = new StreamFilter();
  assert.equal(filter.push('```json\n{"name":"x"}'), '');
  assert.equal(filter.flush(), '');
});

test('flush resets the filter for reuse', () => {
  const filter = new StreamFilter();
  filter.push('<tool_call>{"name"');
  filter.flush();
  assert.equal(filter.push('plain'), 'plain');
});

test('a trailing backtick is LOST at end of stream', () => {
  // CURRENT BEHAVIOUR, and a small content-loss defect: flush() only returns held text in `prose`
  // and `fence_close` modes, so a lone backtick sitting in `fence_open` is dropped. Inline code that
  // ends the reply loses its closing tick. See the report.
  const filter = new StreamFilter();
  assert.equal(filter.push('use `code`'), 'use `code');
  assert.equal(filter.flush(), '');
});

// ============================================================ chunk-boundary independence, hard

test('a tag split across every possible chunk boundary still strips', () => {
  const input = 'a<tool_call>{"name":"x"}</tool_call>b';
  for (let cut = 0; cut <= input.length; cut += 1) {
    assert.equal(feed([input.slice(0, cut), input.slice(cut)]), 'ab', `split at ${cut}`);
  }
});

test('a fenced call split across every possible chunk boundary still strips', () => {
  const input = 'a```json\n{"name":"x"}\n```b';
  for (let cut = 0; cut <= input.length; cut += 1) {
    assert.equal(feed([input.slice(0, cut), input.slice(cut)]), 'ab', `split at ${cut}`);
  }
});

test('a non-tool object split across every possible chunk boundary still round-trips', () => {
  const input = 'a{"k":"v"}b';
  for (let cut = 0; cut <= input.length; cut += 1) {
    assert.equal(feed([input.slice(0, cut), input.slice(cut)]), input, `split at ${cut}`);
  }
});
