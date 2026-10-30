// Pins the boot floor's verdict AND its diagnosis. Both halves are the point: the whole reason the
// check exists (OPEN-QUESTIONS.md #79b) is that without it the user is told "no model here supports
// tools" when the truth is "your daemon cannot say" — so a refusal that does not name the daemon
// version would be the same defect wearing a different message.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ollamaVersionRefusal } from '../ollama-version-refusal.js';

test('a daemon at or above the floor is not refused', () => {
  assert.equal(ollamaVersionRefusal('0.9.1'), undefined, 'exactly the floor');
  assert.equal(ollamaVersionRefusal('0.9.2'), undefined);
  assert.equal(ollamaVersionRefusal('0.10.0'), undefined, 'a string compare would refuse this');
  assert.equal(ollamaVersionRefusal('0.33.2'), undefined, 'the version this box reports');
});

test('a daemon below the floor is refused, naming the requirement AND what was found', () => {
  const refusal = ollamaVersionRefusal('0.8.0');
  assert.ok(refusal !== undefined, 'must refuse');
  assert.match(refusal, /0\.9\.1 or newer is required/);
  assert.match(refusal, /found 0\.8\.0/);
});

test('the refusal says what to do, not only what is wrong', () => {
  const refusal = ollamaVersionRefusal('0.6.4');
  assert.ok(refusal !== undefined);
  assert.match(refusal, /Upgrade Ollama/);
});

test('the refusal explains that the DAEMON is the reason, not the models', () => {
  // This is the diagnosis the check exists to deliver. Without it, the fail-closed capability gate
  // reports the symptom ("nothing supports tools") and hides the cause.
  const refusal = ollamaVersionRefusal('0.8.0');
  assert.ok(refusal !== undefined);
  assert.match(refusal, /\/api\/tags/);
  assert.match(refusal, /every installed\s+model would look incapable/);
});

test('a daemon that reports NO version refuses too — a check that cannot run is not a pass', () => {
  const refusal = ollamaVersionRefusal(undefined);
  assert.ok(refusal !== undefined, 'undefined must not be treated as a pass');
  assert.match(refusal, /Cannot check the Ollama version/);
  assert.match(refusal, /did not report one/);
  assert.doesNotMatch(refusal, /it said/, 'there was nothing to quote back');
});

test('a version string that cannot be parsed refuses and quotes it back', () => {
  const refusal = ollamaVersionRefusal('unknown');
  assert.ok(refusal !== undefined);
  assert.match(refusal, /Cannot check the Ollama version/);
  assert.match(refusal, /it said 'unknown'/);
});

test('the refusal is one string with real line breaks, ready for fail()', () => {
  // fail() prints the message through console.error and exits; nothing wraps or re-indents it, so the
  // layout has to already be right here.
  const refusal = ollamaVersionRefusal('0.8.0');
  assert.ok(refusal !== undefined);
  assert.equal(typeof refusal, 'string');
  assert.ok(refusal.includes('\n\n'), 'a blank line after the headline, like the Node check');
  assert.equal(refusal.includes('\r'), false, 'no stray carriage returns');
});
