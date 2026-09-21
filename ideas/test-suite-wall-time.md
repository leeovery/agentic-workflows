# Cut the Test Suite's Wall Time

## The Idea

`npm test` takes about ten minutes on an engine change. Almost all of it
is two suites that drive the engine through spawned processes and rebuild
git repositories from scratch; the other seventy-odd files finish in
seconds. Run the engine in-process where a test only needs its output,
build worlds in parallel, and the same coverage should land in a minute
or two.

Logged 2026-09-20 from the walkthrough build, where every slice touched
the engine and so paid the full price on every gate.

## Where the Time Goes

Measured one suite at a time on the walkthrough branch (Node 26, M-series
Mac, `WORKFLOWS_DISPLAY_WIDTH=65`):

| Suite | Alone | Why |
|---|---|---|
| `test-pipeline-simulation.cjs` | 135s | 1,063 engine calls, each `spawnSync('node', [engine, …])` — a fresh Node process and a full module load per call |
| `test-prose-snapshots.cjs` | 525s | rebuilds every one of 159 prose-test worlds whenever anything under `skills/workflow-engine/scripts/` changed — each build runs its recipe's engine calls as spawned processes, layers real git commits for the world's history, and runs `knowledge setup --keyword-only` as another spawn |
| `test-engine-render-surfaces.cjs` | 2s | in-process; 423 tests |

`node --test` already runs files concurrently, so the wall time is the
slowest file plus the CPU contention of everything else running beside
it. The snapshot suite's skip rule (`recipeHash` in
`tests/prose/lib/worlds.cjs`) hashes the whole engine source tree, so a
one-line engine change invalidates all 159 worlds; on a prose-only
change the suite costs nothing.

## Directions

Cheapest first; each stands alone.

1. **Run the engine in-process in the simulation.** Export a programmatic
   entry from `engine.cjs` (the CLI already funnels through `runCli`) that
   takes argv and a cwd and returns stdout/stderr/exit, and have the
   simulation's harness call it instead of `spawnSync`. Process start-up
   and module load are the whole cost; the calls themselves are
   milliseconds. Environment that the engine reads from `process.env`
   (`CLAUDE_PID`, `WORKFLOWS_DISPLAY_WIDTH`, the presence identity) needs
   passing explicitly or setting around the call. Expected: 135s → well
   under 20s.

2. **The same for the world builder.** `worlds.cjs` line ~144 spawns the
   engine per recipe call and line ~619 spawns `knowledge setup` per
   world. In-process for the engine; for the knowledge store, build one
   keyword-only store once and copy it into each world (it is identical
   every time).

3. **Build worlds in parallel.** The snapshot suite rebuilds worlds
   serially. Each world is an independent temp directory, so the
   `describe` can take `{ concurrency: true }` (or the builder can fan
   out over a worker pool) and use the cores the machine has. Git is the
   remaining per-world cost; layering history through `git fast-import`
   in one process per world instead of one `git commit` per layer would
   take most of that out too.

4. **Finer invalidation, carefully.** Hashing only the engine files a
   recipe actually executes would skip most rebuilds on most changes, but
   correctness of the skip is the whole point of the suite and a wrong
   skip is a silent golden. Only worth it after 1–3, and only with the
   dependency set recorded by the build itself rather than guessed.

## What Not To Do

Splitting the slow suites out of `npm test` into a separate gate. The
simulation is the detector for silent state corruption and the snapshot
goldens are what keep prose tests honest; a gate nobody runs on every
change is a gate that fails on main.
