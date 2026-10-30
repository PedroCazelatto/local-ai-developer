// Pins recoverToolCalls, the second of the two places a model's malformed output is parsed. Ollama
// does not lift qwen2.5-coder's text-emitted calls into `message.tool_calls`, so without this shim
// the orchestrator never sees the call and the turn loop cannot dispatch. Two things must hold:
// every shape the model actually emits is recovered, and the content the user is shown has the
// recovered span cut out of it cleanly — no orphaned fence, no half object.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { recoverToolCalls } from '../recover-tool-calls.js';

/** The single call `content` must yield, asserting the count so a silent zero cannot pass. */
function oneCall(content: string): { name: string; args: Record<string, unknown> } {
  const { calls } = recoverToolCalls(content);
  assert.equal(calls.length, 1, `expected exactly one recovered call from ${JSON.stringify(content)}`);
  const call = calls[0];
  assert.ok(call !== undefined);
  return { name: call.function.name, args: call.function.arguments };
}

// ================================================================================== tagged form

test('a tagged call is recovered and cut out of the content', () => {
  const { cleaned, calls } = recoverToolCalls('<tool_call>{"name":"read_file","arguments":{"path":"a.ts"}}</tool_call>');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { function: { name: 'read_file', arguments: { path: 'a.ts' } } });
  assert.equal(cleaned, '');
});

test('prose around a tagged call survives, trimmed', () => {
  const { cleaned } = recoverToolCalls('Reading it now.\n<tool_call>{"name":"read_file"}</tool_call>\nDone.');
  assert.equal(cleaned, 'Reading it now.\n\nDone.');
});

test('several tagged calls are all recovered, in order', () => {
  const { cleaned, calls } = recoverToolCalls(
    '<tool_call>{"name":"a"}</tool_call> mid <tool_call>{"name":"b"}</tool_call>',
  );
  assert.deepEqual(calls.map((c) => c.function.name), ['a', 'b']);
  assert.equal(cleaned, 'mid');
});

test('whitespace inside the tags is tolerated', () => {
  assert.equal(oneCall('<tool_call>\n  {"name":"x"}\n</tool_call>').name, 'x');
});

test('a tagged payload that is not decodable leaves the content alone', () => {
  const content = '<tool_call>{not json}</tool_call>';
  const { cleaned, calls } = recoverToolCalls(content);
  assert.deepEqual(calls, []);
  assert.equal(cleaned, content);
});

test('a tagged object that is not a call shape is not recovered', () => {
  const content = '<tool_call>{"note":"just an object"}</tool_call>';
  assert.deepEqual(recoverToolCalls(content).calls, []);
  assert.equal(recoverToolCalls(content).cleaned, content);
});

// ==================================================================================== bare form

test('a bare top-level JSON call is recovered', () => {
  const { cleaned, calls } = recoverToolCalls('{"name":"list_files","arguments":{"path":"src"}}');
  assert.deepEqual(calls, [{ function: { name: 'list_files', arguments: { path: 'src' } } }]);
  assert.equal(cleaned, '');
});

test('a bare call embedded in prose is cut out and the prose trimmed', () => {
  const { cleaned } = recoverToolCalls('Let me look.\n{"name":"list_files"}\nThere.');
  assert.equal(cleaned, 'Let me look.\n\nThere.');
});

test('several bare calls are all recovered', () => {
  const { calls } = recoverToolCalls('{"name":"a"} and {"name":"b"}');
  assert.deepEqual(calls.map((c) => c.function.name), ['a', 'b']);
});

test('a bare object that is not a call shape is left in the content', () => {
  const content = 'Config: {"retries":3,"timeout":10}';
  const { cleaned, calls } = recoverToolCalls(content);
  assert.deepEqual(calls, []);
  assert.equal(cleaned, content);
});

test('the tagged pass wins outright — a bare object beside a tagged call is untouched', () => {
  // The bare scan only runs when the tagged pass found nothing, so a quoted JSON example sitting
  // next to a real tagged call cannot be swept up as a second call.
  const { cleaned, calls } = recoverToolCalls('<tool_call>{"name":"a"}</tool_call> see {"name":"b"}');
  assert.deepEqual(calls.map((c) => c.function.name), ['a']);
  assert.equal(cleaned, 'see {"name":"b"}');
});

// ============================================================================== the key variants

test('all three name keys are accepted', () => {
  for (const key of ['name', 'function_name', 'tool']) {
    assert.equal(oneCall(`{"${key}":"read_file"}`).name, 'read_file');
  }
});

test('both argument keys are accepted', () => {
  assert.deepEqual(oneCall('{"name":"x","arguments":{"a":1}}').args, { a: 1 });
  assert.deepEqual(oneCall('{"name":"x","parameters":{"a":1}}').args, { a: 1 });
});

test('missing arguments default to an empty object, never undefined', () => {
  assert.deepEqual(oneCall('{"name":"x"}').args, {});
});

test('arguments delivered as a JSON STRING are decoded', () => {
  assert.deepEqual(oneCall('{"name":"x","arguments":"{\\"path\\":\\"a.ts\\"}"}').args, { path: 'a.ts' });
});

test('literal control characters inside arguments are repaired', () => {
  // The fault this whole module exists for: a real newline inside a JSON string value.
  const { args } = oneCall('{"name":"write_file","arguments":{"content":"line1\nline2"}}');
  assert.deepEqual(args, { content: 'line1\nline2' });
});

// ========================================================================================= fences

test('a fenced tagged call is stripped together with its fence', () => {
  const { cleaned, calls } = recoverToolCalls('```json\n<tool_call>{"name":"x"}</tool_call>\n```');
  assert.equal(calls.length, 1);
  assert.equal(cleaned, '');
});

test('a fenced bare call is stripped together with its fence', () => {
  const { cleaned, calls } = recoverToolCalls('Here:\n```json\n{"name":"x"}\n```\nok');
  assert.equal(calls.length, 1);
  assert.equal(cleaned, 'Here:\n\nok');
});

test('an unclosed fence around a call is still eaten, so no opener is orphaned', () => {
  const { cleaned, calls } = recoverToolCalls('```json\n{"name":"x"}');
  assert.equal(calls.length, 1);
  assert.equal(cleaned, '');
});

// ============================================================================= the no-call path

test('content with no call comes back byte-identical and UNTRIMMED', () => {
  // Asymmetric with the recovery paths, which trim. Pinned as CURRENT behaviour: the no-call return
  // is the caller's own string, so nothing can be lost by passing a reply through this function.
  const content = '\n  just prose, nothing to recover.  \n';
  const { cleaned, calls } = recoverToolCalls(content);
  assert.deepEqual(calls, []);
  assert.equal(cleaned, content);
});

test('the empty string is handled', () => {
  assert.deepEqual(recoverToolCalls(''), { cleaned: '', calls: [] });
});

test('a recovered result IS trimmed, unlike the no-call result', () => {
  assert.equal(recoverToolCalls('  {"name":"x"}  ').cleaned, '');
});
