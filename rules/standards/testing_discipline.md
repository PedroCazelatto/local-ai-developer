---
name: testing-discipline
description: Test-first ordering, what makes a failing test meaningful, mocking boundaries, arrange conventions, assertion granularity, one behavior per test. Use when writing or reviewing tests, or deciding whether a test actually proves anything.
---

# Standard: Testing Discipline

Tests are written before the code they cover and prove one observable behavior each.

- Write the failing test **first**, run it, and watch it fail for the expected reason before writing any implementation.
- A meaningful failing test fails because the behavior is missing — not from a typo, import error, or unbuilt scaffold.
- One behavior per test; the test name states that behavior in plain words.
- Never mock the unit under test — mock only its collaborators at the boundary (network, disk, clock, randomness).
- Prefer real values and objects over mocks when they are cheap and deterministic.
- Assert on observable outputs and behavior, not on internal calls or private state.
- Assertions are specific: assert the exact value, not merely "truthy" or "not null".
- Arrange–Act–Assert: separate the setup, the single action, and the assertions.
- Keep fixtures minimal and local so a test reads top-to-bottom without hunting for hidden setup.
- Cover edge and error paths, not only the happy path.
- Tests are deterministic — no reliance on real time, run order, or the network.
- A test that cannot fail is not a test; fix it or delete it.

**Do:** `expect(total).toBe(42)` — assert the exact result.
**Don't:** `expect(total).toBeTruthy()` — passes for the wrong value.

**Do:** mock the HTTP client the function calls.
**Don't:** mock the function you are testing.
