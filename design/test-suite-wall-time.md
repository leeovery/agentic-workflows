# Test Suite Wall Time — hermetic, in-process, cached

`npm test` takes nine minutes on main. The suite grew with the product
and was never designed as a whole: each suite hand-rolls its own
fixtures, most drive the engine through a spawned process per
assertion, and the prose goldens rebuild every world on every run. This
programme makes the suite hermetic, moves the engine in-process where a
test only needs its output, and gives the golden skip a cache that
works — without moving anything out of the one gate everyone runs.
Design log for the programme. Opened 2026-09-20.

## Motivation (2026-09-20)

Measured on main at v0.7.68, 10-core Mac, clean tree,
`WORKFLOWS_DISPLAY_WIDTH=65`. The full `npm test` is 9m09s wall clock
for 3,304 tests at 178% CPU — one file serialises the run while the
other 82 finish beside it. Serially, one file at a time:

| Gate | Serial total |
|---|---|
| `npm test` (83 node files) | 1019s |
| `npm run test:cli` (4 shell suites) | 91s |
| `npm run test:migrations` (46 shell suites) | 56s |

49 of the 83 node files finish under a second and sum to 14s. Seven
files take 80% of the time: prose snapshots 483s, pipeline simulation
138s, transactions 80s, session-label 43s, roadmap 39s, boot 30s,
commit-door 22s. Three causes account for nearly all of it.

**The golden skip never fires.** `test-prose-snapshots.cjs` skips a
world whose recipe hash is unchanged, where the hash covers every file
under `skills/workflow-engine/scripts/`. The stored copy lives inside
each committed snapshot and only `run.cjs snap` refreshes it — so after
any engine PR every case's stored hash is stale until someone re-snaps
all 156, which nobody does. On main today 154 of 156 are stale: every
run rebuilds 154 worlds at ~2.8s each, serially inside one file. The
file is the critical path of the whole run whatever the parallelism.

**The node suites are not hermetic and call OpenAI.** They never
isolate the system config, so every knowledge-indexing verb — `topic
complete`, `workunit complete|cancel|reactivate`, absorb, promote, a
`--kb` commit; roughly 330 calls per run — reads the developer's real
`~/.config/workflows/config.json` and embeds through
`text-embedding-3-small` for real. `topic complete` measures 779ms
against the real config and 152ms against an empty one. Beyond the
time, the suite fails offline, spends money, and depends on whose
machine it runs on. Only `test-knowledge-cli.sh` fakes `HOME`. The
prose worlds are safe by a different route: every mainline runs
`knowledge setup --keyword-only` first, and the project config it
writes overrides the system one — a convention each recipe happens to
follow, not an invariant the harness holds.

**A process per assertion.** An engine CLI spawn is ~60ms, a git commit
~30ms, `engine boot` ~1.5s because the migration orchestrator spawns a
bash per frozen migration (46 of them). The transactions, simulation,
boot, roadmap, experiment, and commit-door suites pay this per
assertion; the simulation alone issues 1,063 spawns. The in-process
suites show the ceiling: render-surfaces runs 411 tests in 1.5s. 28
files hand-roll their fixture helpers (`setup`, `git`, `engine`,
`engineFails`, `writeManifest`); 22 share `discovery-test-utils.cjs`.

The idea that opened this (`ideas/test-suite-wall-time.md`, PR #1237)
measured the first and third causes on the walkthrough branch and set
the directions below; it missed that the skip is stale on main and that
the suite is on the network.

## Rulings

- **One gate.** Everything stays in `npm test`. The simulation is the
  detector for silent state corruption and the goldens are what keep
  the prose tests honest; a gate that runs only before a PR is a gate
  that fails on main. The suite gets fast instead of getting split.
- **Never on the network.** A test never reads the developer's config,
  credentials, or environment key, and never reaches an embedding
  provider. The knowledge store in every test world is keyword-only.
  This is a suite invariant with its own guard test, not a convention.
- **One harness.** A single test-support module owns the hermetic
  environment, the git fixture, and the engine runner. Suites adopt it
  as they are touched; hand-rolled copies retire with the adoption.
- **The CLI contract stays black-box.** Suites that drive the engine by
  argv keep doing so — through an in-process entry that takes argv and
  a cwd and answers with stdout, stderr, and an exit code, exactly what
  the spawned process answered. Process start-up was the cost; the
  contract is unchanged.
- **The golden is the snapshot tree; the skip is a local cache.** The
  recipe hash moves out of the committed snapshot into a gitignored
  cache the verify itself maintains: a byte-identical rebuild records
  the hash, so the second run after an engine change costs nothing and
  no PR carries 166 hash-file edits. A stale cache can only cause a
  rebuild, never a skip.
- **Snapshot diffs still land with the change that moved them.**
  Unchanged: `run.cjs snap` regenerates a moved world and the diff
  rides the PR.

## The programme

Cheapest and safest first; each slice stands alone and is measured
before the next starts.

### 1. Hermetic environment

A test-support module pins `WORKFLOWS_CONFIG_DIR` to an empty
per-process temp dir, clears `OPENAI_API_KEY`, points git's global and
system config at `/dev/null`, and pins the display width, `TZ`, and
the git author date where a suite needs byte-stable output. Every node
suite that spawns the engine or the knowledge CLI requires it at load;
`recipeEnv` in `tests/prose/lib/worlds.cjs` composes it; the shell
tiers export the same variables in their npm scripts. A guard test
asserts that a `knowledge check` run under the suite's environment
reports no provider, so a future suite that forgets the module fails
here rather than silently billing the developer.

Expected: the suite runs offline; no spend. The wall-time gain is small
— most fixtures name an artifact the test never wrote, so the CLI
refused before embedding; only the calls whose artifact existed reached
the provider.

**Landed 2026-09-21 (#1241).** Transactions 81.0s → 73.7s, absorb 14.7s
→ 14.0s, commit-door 20.8s → 19.0s; the full run flat at 3,340 tests,
no golden moved. Two suites that steer the system config through a
fake `$HOME` take the override off the environment they pass down
(`test-engine-boot.cjs`, `test-knowledge-setup-forms.cjs`), as does
`test-knowledge-cli.sh`. The one test that reaches the real API left
the gate as `knowledge-openai-smoke.cjs`, run by hand with a key.
Found on the way, out of scope: a `knowledge index` under a config
naming `openai` with no resolvable key silently builds a keyword-only
store and says nothing.

### 2. Golden skip and parallel rebuild

`verifySnapshot` reads and writes the recipe hash in
`tests/prose/.cache/` (gitignored), recording it after a byte-identical
rebuild; the committed `.recipe-hash` files go, and `run.cjs snap`
writes to the cache too. The engine's share of the hash is computed
once per process, not once per case. Rebuilds fan out over a
`worker_threads` pool sized to the machine — each world is an
independent temp directory and the recipe code is synchronous, so a
worker runs it unchanged — and the test file reports one result per
case as it does now.

Expected: 483s → about a minute on an engine change, zero after.

**Landed 2026-09-21 (#1243).** Cold (cache removed) 93s at 600% CPU on
a pool of nine; warm 0.26s with all 171 worlds skipping; the full
`npm test` 9m09s → 3m48s warm, 3,351 tests, no golden moved. 171
committed hash files gone. The cold gate oversubscribes the machine
inside a full run (nine threads beside the other files' processes);
slice 3 cuts the per-world cost rather than the parallelism.

### 3. The engine in-process

`engine.cjs` exports an in-process entry for callers in the same
process: argv plus a cwd, an env, and a stdin, answering `{stdout,
stderr, code}`. The cwd is threaded through the command handlers as a
parameter rather than set on the process — `process.chdir` is refused
inside a worker thread, and the world builder now runs in one. The
four `process.exit` sites become a thrown exit the entry catches; the
response writers and the hook's stdin read go through the call's own
streams; the env keys a call carries (the presence identity) are set
for its duration and restored; the one module-level memo (the terminal
width) is reset per call. The simulation's harness and the prose world
builder's `makeHarness` switch to it. Git and the knowledge CLI still
spawn — the engine's own subprocesses are not this slice's concern.
The proof the in-process path equals the spawned one is the corpus
itself: every world must rebuild byte-identical through it.

Expected: simulation 138s → under 20s; world rebuilds roughly halved
again.

### 4. Adoption and the boot seam

The remaining CLI-driving suites (transactions, roadmap, experiment,
commit-door, tasks, discovery-map, session-label, agent-state, the
workunit verbs) move onto the shared harness's in-process runner;
their local `engine`/`engineFails`/`setupGitFixture` copies retire.
The boot suite gets a fixture whose migration ledger already records
every migration, so the 42 tests that are not about migrations stop
replaying 59 of them; the nine that are keep the real fleet.

Expected: the 20–80s files land under 15s each.

### 5. Close

Re-measure the whole run and record it below. Update the Test Gates
section of CLAUDE.md (the harness module, the in-process runner, the
golden cache, the no-network invariant). Retire the idea file and its
index row.

## Explicitly parked

- **Finer golden invalidation** (the idea's fourth direction): hashing
  only the engine files a recipe executes. A wrong skip is a silent
  golden; only worth it with a dependency set the build records itself,
  and only if the parallel rebuild is still too slow.
- **`git fast-import` for layered history**: git is the residual
  per-world cost after 2 and 3. Measure before touching.
- **One keyword-only store per run, copied into each world**: every
  mainline sets the store up per recipe, ~80ms hermetic; across a
  parallel rebuild it is seconds. Not worth a recipe-semantics change
  unless the profile says otherwise.
- **The knowledge CLI in-process**: `domain/kb.cjs` spawns the bundle;
  hermetic it costs ~100ms a call. Revisit if it shows in the profile.
- **The migration orchestrator in one bash**: `engine boot` spawns a
  bash per frozen migration. The fixture seam in 4 removes the cost
  from the tests; the shipped orchestrator's semantics stay untouched.
- **Splitting the simulation into files** for parallelism: unnecessary
  once it runs in-process.
- **The shell tiers** (`test:cli`, `test:migrations`): 147s serial,
  outside `npm test`, same spawn-per-assertion shape. Hermetic env only
  in this programme; a port to node is its own decision.

## Measurement

Every slice re-times the files it touched with the serial harness used
for the baseline (one file at a time, `node --test`, width pinned) and
the full `npm test` wall clock, and records both here. Targets: `npm
test` under 60s on an engine change and under 30s otherwise on the
baseline machine; a run with the network down is green.

## Status log

- 2026-09-20 — baseline measured; design opened.
- 2026-09-21 — slice 1 landed as #1241 (draft, stack bottom); the
  network leak was real but the wall-time share small — slices 2–4
  carry the time.
- 2026-09-21 — slice 2 landed as #1243 (stack #1244); the full run is
  under four minutes warm and the simulation is now the critical path.
