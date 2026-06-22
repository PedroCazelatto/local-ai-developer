> **Status:** ⬜ Not started

# 01 — Repo skeleton and toolchain

**Version:** Foundation
**Depends on:** nothing
**Blocks:** everything (02–06 and all of V1–V5 — nothing runs until this exists)

## Why

The orchestrator is being rewritten from Python to **TypeScript on Node** (ROADMAP "The pivot"). Nothing in any other Foundation task can be built until the TS project, its toolchain, and the empty source tree exist. This task is the gate: it stands up `package.json`, a strict `tsconfig`, the full `src/` layout, the dev/build scripts, and a thin `run.ps1` wrapper that replaces the Python verbs. The Python tree stays as reference-only and is deleted only once the TS build reaches parity (do **not** delete it in this task).

## Behavior

From a clean checkout, `.\run.ps1 install` installs Node deps and builds the sandbox image; `.\run.ps1 start <project>` launches the TS CLI locked to that project; `.\run.ps1 stop` tears Docker down. `run.ps1` is a **thin wrapper** that shells out to `npm`/`node` — it contains no orchestration logic of its own.

### package.json

- `"type": "module"` (NodeNext / ESM; the `ollama`, `@clack/prompts`, `chalk`, and `ora` packages are ESM).
- Engines: Node latest LTS (e.g. `"engines": { "node": ">=22" }`).
- **Runtime dependencies:** `ollama`, `dockerode`, `@clack/prompts`, `chalk`, `ora`, `dotenv`.
- **Dev dependencies:** `typescript`, `tsx`, `@types/node`, `@types/dockerode`.
- **Scripts:**
  - `"dev": "tsx src/index.ts"` — run directly from TS, no precompile (fast inner loop).
  - `"build": "tsc"` — typecheck + emit JS to `dist/`.
  - `"start": "node dist/index.js"` — run the built output.
  - `"typecheck": "tsc --noEmit"`.

**Dev-run vs build:** use **`tsx`** for the dev loop (no build step, fast iteration) and keep `tsc` for typechecking and an optional production build. `run.ps1 start` should invoke `npm run dev -- <project>` so day-to-day use needs no build. (`tsc`-only with `node dist/` is the fallback if `tsx` ever proves flaky; document the choice in a comment.)

### tsconfig.json (strict)

- `"strict": true`.
- `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`.
- `"target": "ES2022"` (or newer matching the Node LTS), `"lib": ["ES2023"]`.
- `"outDir": "dist"`, `"rootDir": "src"`.
- `"esModuleInterop": true`, `"skipLibCheck": true`, `"forceConsistentCasingInFileNames": true`.
- Additional strictness: `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`.
- `"include": ["src"]`.

### Target `src/` tree (create empty/placeholder modules)

```
src/
├── index.ts                 # CLI/REPL entry; owns argv parse + boot (filled in by 02)
├── core/
│   ├── session/             # orchestrator, memory, phase factory (06)
│   ├── container/           # dockerode sandbox client (04)
│   ├── llm/                 # Ollama client + stream filtering (03)
│   └── ui/                  # persistent REPL renderer + theme (05)
├── phases/                  # Phase abstraction + factory (06)
├── context/                 # system-prompt / context builders
├── interface/               # terminal input/REPL loop wiring (05)
└── tools/                   # model-callable actions (wired in V1; empty seam now)
```

Each folder gets at minimum an `index.ts` (can be a stub that re-exports nothing yet) so imports resolve and the tree is real, not aspirational.

### run.ps1 verbs (thin wrapper)

Replace the Python-era verbs. Keep the same `param([string]$Action, [string]$Project)` shape.

- `install` → `npm install`, then build the sandbox image (`docker compose build`, or `docker compose pull` if the sandbox uses a stock image — see task 04). No Python venv.
- `start <project>` → require `$Project`; set `$env:ACTIVE_PROJECT = $Project`; `docker compose up -d`; then `npm run dev -- $Project`; in a `finally` block, `docker compose stop`. (Mirrors the old `start` lifecycle but calls Node, not `python`.)
- `stop` → `docker compose stop`.
- A default branch printing the available verbs.

Drop the old `run`/`up`/`down` verbs unless you want them; `start`/`stop`/`install` are the documented three.

## Files

- `package.json` — new; deps, scripts, `"type": "module"`, engines.
- `tsconfig.json` — new; strict + NodeNext as above.
- `.gitignore` — add `node_modules/`, `dist/`.
- `src/index.ts` and one `index.ts` per `src/**` subfolder — new stubs establishing the tree.
- `run.ps1` — **rewrite** the existing file: thin wrapper over `npm`/`node`/`docker compose`, verbs `install` / `start <project>` / `stop`.
- (Do **not** touch `main.py`, `core/`, `agents/`, `interface/`, `requirements.txt` — Python is reference-only until parity.)

## Notes / pitfalls

- **ESM is mandatory** — `ollama`, `@clack/prompts`, `chalk@5`, `ora@8` are ESM-only. `"type": "module"` plus NodeNext avoids `ERR_REQUIRE_ESM`. Relative imports in NodeNext ESM need explicit extensions in emitted code; with `tsx` for dev this is smoother, but write imports as `./foo.js` (the `.js` resolves the `.ts` source under NodeNext).
- Do not add any Python. Do not delete the Python tree here — parity comes later (after 06 + V1). The two trees coexist during the rewrite.
- `run.ps1` must stay thin: no token logic, no Docker exec logic, no model calls. All real behavior lives in `src/`.
- Keep `.env.example` as-is for now (task 02 reads it); don't expand it here.

## Acceptance

- `.\run.ps1 install` completes: `node_modules/` is populated and the sandbox image build/pull step runs without error.
- `npm run typecheck` passes against the empty/stub tree (strict mode, zero errors).
- `npx tsx src/index.ts hello-world` runs `src/index.ts` (even if it only prints a placeholder line and exits) — proving the ESM/NodeNext toolchain executes TS directly.
- `.\run.ps1 start hello-world` reaches the point of invoking `npm run dev -- hello-world` (the REPL itself is built in later tasks; here it's enough that the wrapper dispatches to Node and `finally` runs `docker compose stop`).
- The `src/` tree exists with every folder listed above present and importable.
