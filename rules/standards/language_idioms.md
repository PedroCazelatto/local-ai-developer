---
name: language-idioms
description: Idiomatic typing and constructs for TypeScript and Python — no any/typing.Any, boundary narrowing, immutability, discriminated unions, Protocol/TypedDict/dataclass. Use when writing or reviewing code in either stack for idiom and type-safety.
---

# Standard: Language Idioms

Write idiomatic, fully-typed code for the project's stack — TypeScript or Python — never leaning on an escape hatch to silence the type checker.

## TypeScript

- Never use `any`; reach for concrete types, generics, or `unknown` with narrowing.
- Prefer `interface`/`type` for shapes and discriminated unions for variant data.
- Narrow `unknown` at every boundary (parsed JSON, external input) before use.
- Mark fields `readonly` where they do not change; prefer immutable data.
- No non-null `!` to silence the checker — prove non-null with a guard.
- Avoid `as`; use it only when a type is genuinely unknowable, and comment why.
- Prefer `const`; use `let` only when the binding is reassigned.

## Python

- Type-hint every parameter and return; never use `typing.Any`.
- Use `Protocol`/`TypedDict`/`@dataclass` for boundary and structured types.
- No implicit `Optional` — write `X | None` (or `Optional[X]`) explicitly.
- Prefer `@dataclass(frozen=True)` or tuples for immutable value objects.
- Narrow `object` and unions with `isinstance` before use.
- Use comprehensions for simple transforms, not for side effects.

**TS Do:** `function f(x: unknown) { if (typeof x === "string") { … } }`
**TS Don't:** `function f(x: any) { … }`

**Py Do:** `def load(p: Path) -> Config: ...`
**Py Don't:** `def load(p): ...`  (untyped, returns `Any`)
