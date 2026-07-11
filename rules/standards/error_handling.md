---
name: error-handling
description: Throw/raise vs. return, no bare or blanket catch/except, error types as API surface, wrapping vs. propagating, never swallow silently, recoverable structured errors for tools. Use when writing or reviewing how code signals and handles failure.
---

# Standard: Error Handling

Signal failure deliberately and handle only what you can, letting everything else propagate with its context intact.

- Throw/raise for exceptional, unrecoverable conditions; return a value or result for expected outcomes.
- No bare or blanket `catch`/`except:` — catch only the specific error types you can actually handle.
- Error types are part of the API: name them, and make clear what a function can throw or raise.
- Wrap a lower-level error only to add context, and preserve the cause (`{ cause }`, `raise … from`).
- Let an error propagate when the current layer cannot handle it meaningfully.
- Never swallow an error silently — at minimum log it with context, or rethrow.
- Validate inputs at the boundary and fail fast with a clear, specific message.
- For tools and model-facing operations, return a **structured, recoverable** error, not a crash.
- Don't use exceptions for normal control flow.
- Release resources in `finally` / context managers on every path, including the error path.

**Do:** `catch (e) { throw new ConfigError("invalid config", { cause: e }); }`
**Don't:** `catch (e) {}` — the failure vanishes.

**Py Do:** `except FileNotFoundError:` — handle the case you expect.
**Py Don't:** `except Exception:` — hides bugs you never meant to catch.
