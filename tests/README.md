# Tests

How a test is written in this repository. Read it before writing or changing a suite. A test gets the same care as production code: each one checks something no other test checks, fails when the behaviour it covers breaks, and costs as little time as it can.

The standing rules (the gates, the hermetic environment, the Claude Code floor, the simulation, the knowledge eval) are CLAUDE.md's (Tests). Each support module's header states its own contract; this page says which to reach for.

## 1. The gates

Run all of them before every commit. Never pipe a gate's output: a pipe swallows the exit code. Redirect to a file and check `$?`.

| Gate | What it runs |
|---|---|
| `npm test` | every node suite (`tests/scripts/test-*.cjs`), listed one by one in `package.json`; its budget is 1.5 min on an idle machine |
| `npm run test:cli` | the shell contract suite of the manifest field surface |
| `npm run test:migrations` | the frozen `test-migration-*.sh` fleet |
| `npm run typecheck` | the JSDoc type contracts (`tsc`) |
| `npm run test:mod` | the gate mods' own suites under `claude plugin test`; owed for any change under `skills/leeway-gates*/` |

`package.json` lists the node suites one by one, slowest first by each one's CPU time run alone, so no long file starts last and runs on alone; a new suite goes where its time places it. `test-suite-list.cjs` holds the script to the folder, so a suite left out fails the run rather than never running: a suite the script leaves out or names twice, or a file it names that is no suite, fails it. A suite is any file under `tests/` that takes a test from `node:test`, whatever its name, extension or folder.

## 2. The layers

Every test belongs to one layer, and every file sits in one. The layer decides how the test runs and what it may cost.

| Layer | What belongs there | How it runs | Budget per file | Example |
|---|---|---|---|---|
| **unit** | A kernel or projection module called with values: render, terminal, state-root path forms, ledger events, ids and folds, the knowledge kernel, the Claude call | In process, no git. A projection takes its state as a value, or as a plain temp folder with `pinStateRoot`, never a copied repository. | under 1 s | `test-render.cjs`, `test-engine-state-root.cjs`, `test-knowledge-store.cjs` |
| **verb** | The engine's argv contract: the response, the state written, the state commit, and a refusal leaving nothing behind | `engine-harness.cjs` in process, over a world copied from a template (§3) | ≤ 15 s, ≤ ~100 tests | `test-engine-ledger-write.cjs`, `test-engine-workunit-create.cjs` |
| **git** | What only real git shows: the state worktree, the merge between clones, push and catch-up, the commit door across repos, lost-state recovery | Real repositories from the git world templates (§3): a project, a project with a bare remote, two machines | ≤ 30 s | `test-engine-state-merge-catch-up.cjs`, `test-engine-state-worktree.cjs` |
| **process** | What only a process shows: the real CLI's exit codes and streams, hooks fed stdin JSON, races between processes, detached launches, killed writers | Spawned; each race proves its contention happened (§6) | a handful of tests, beside the verb they concern | the hook tests in `test-engine-layout-hook.cjs`; the races in `test-engine-manifest-io.cjs` |
| **conformance** | One contract run against each driver (§10) | One suite per kind of driver, parametrised over the drivers | — | `test-engine-task-conformance.cjs`, `test-engine-landing-conformance.cjs` |
| **simulation** | End-to-end replays of the engine call sequences the prose makes, with the state oracle after every mutation (§11) | In process | ≤ 30 s per scenario file | `test-pipeline-simulation-feature.cjs` |
| **migration** | One suite per migration, against a plain temp project of the shape it migrates from (§9) | `run()` called in process | — | `test-migration-070.cjs` |
| **prose** | The prose harness's own units and its corpus perimeter (§13) | `tests/prose/` | — | `test-prose-invariants.cjs` |

The shell tier is closing. The frozen `.sh` migration fleet stays as it is. The `test:cli` suite becomes verb-layer node suites, or is deleted with its behaviour. Nothing new is written in bash.

## 3. The fixture library

**The target is one library, one home per helper.** `engine-harness.cjs` and `discovery-test-utils.cjs` grow into it; the file names can stay. It holds:

- **the hermetic environment**, unchanged, required first;
- **the in-process engine:** `call`, `callAsync`, `ok`, `okSections`, `refuses`, `output`, and `refusedPristine(dir, args)`, which checks a refusal and that the tree and the state branch are as they were;
- **worlds, built once per process and copied:** a project; a project with a bare remote; two machines on one remote; a copied engine tree with a stub `migrate.cjs` whose behaviour the test picks through the environment. Named product worlds ("an epic mid-discussion with two topics") are built through the verbs once per process, then copied, never written as hand-made manifests;
- **paths from one place:** a layout helper over the engine's own resolver (`statePath`, `stateRelative`), so a layout change touches one file;
- **state reads:** `stateGit`, `head`, `lastMessage`, `treeSnapshot`;
- **a frozen clock** for the engine in process;
- **stubs:** `claude-stub`, `tmux-stub`, the `gh` stub for the landing driver (`tests/drivers/github/`), and `githubOffline`.

**What exists today:**

| Module | What it owns |
|---|---|
| `hermetic-env.cjs` | the pinned environment. Every node suite requires it first; `test-hermetic-env.cjs` enforces that. |
| `engine-harness.cjs` | the in-process engine's shapes and `refusedPristine(dir, args)`; the state reads: `stateGit`, `head`, `lastMessage`, `touched` (the files a commit touched), `treeSnapshot`, `ledgerEntries` (the ledger as the engine reads it), `tip`, `remoteTip`; `commitAll`, `commitCode` (the code tree alone), `commitOnState`, `initRepo`, `cloneOf`, `addSubmodule`; `traced(fn)`, the git commands a call ran; `childLimits(t, file, fn)`, the time limit each child a module starts is given; the workflows' own hooks as boot installs them (`WORKFLOW_HOOKS`, `LAYOUT_GROUP`, `GUARD_GROUPS`, `OWN_HOOKS`, `hooked`, `engineHook`); `githubOffline`, `failingTrustAppends` (a trust log whose appends fail as a full disk's do), keyword-only knowledge, `lockAttempts` and `contend` (a race's contenders at a barrier), `killedAt` (an engine call in a child killed at a file call); the frozen clock (`withFrozenClock`, `FROZEN_MS`, `FROZEN_AT`); and the worlds, each built once per process and copied at every call: the project world (`setupGitFixture`), `codeProject(dir, options)` (a code project, with or without its state, on a bare remote or none, sha1 or sha256), `twoMachines(dir)` (two clones of one project on one remote), `stubEngine()` (a copied engine tree whose `migrate.cjs` is a stand-in, its behaviour picked by `STUB_MIGRATE_MODE` and its siblings), `fixtureFrom(prefix, build)` (a project world of a suite's own) and `folderFrom(prefix, build)` (a folder of them) |
| `discovery-test-utils.cjs` | the project world's template, made once per process and copied by `copyWorld` (a folder of repos by `copyFolder`), which relinks each copy's state worktree; `templateFolder(prefix)`, the temp folder a world made once is built in, every template removed at exit by one listener; `bareRepo(dir)`, a bare remote with auto maintenance off; `useTempFolder(prefix)`, a temp folder for each test of the calling file; the paths: `statePath` and `stateRelative`, over the engine's own resolver, and `layout`, every place in the state by name, so a state path is spelled in one file; `writeState`, `readState`, `readManifest`, `createManifest`, `createFile`, `readFile`; `withEnv(env, fn)` and `datedAt` |
| `frozen-clock.cjs` | the frozen clock (`withFrozenClock`, `freeze`), a module of its own because the prose harness preloads it into the engine's process |
| `knowledge-harness.cjs` | the stand-in embeddings endpoint, `engineKnowledge` and `knowledgeDoor` (the knowledge door in process), `heldCall`, `recordLaunches`, `refuseLaunches`, `withoutBackoff`, the `KEYWORD_ONLY`/`STUB`/`OPENAI` settings; and the world the door's suites drive: `knowledgeUnit` (a unit's manifest written by hand — the one exception to named worlds through the verbs), `manifestSet`, `setItems`, `completeUnit`, `setRegistry`, `configureKnowledge`, `knowledgeAt`, `knowledgeMetadata`, `storedChunks`, `systemConfigDir` |
| `gate-audit.cjs` | a gate payload held against the menu it states, its gate named as the trust log keys it |
| `claude-stub.cjs`, `tmux-stub.cjs` | the stand-ins for `claude` and `tmux` |
| `{family}-world.cjs` | what one family's suites share and no other suite uses: its constants, its worlds over the library's, and its helpers over the suite's own world (`boot-world.cjs`, `boot-state-world.cjs`, `state-merge-world.cjs`, `state-worktree-world.cjs`, `ledger-world.cjs`, `decided-world.cjs`, `raise-world.cjs`, `landing-world.cjs`, `trust-world.cjs`, `migration-world.cjs`); a seam that must load before the engine does is a module of its own (`ledger-copies-seams.cjs`) |
| `pipeline-oracle.cjs`, `pipeline-world.cjs` | the simulation's oracle; its world, `Sim` and the steps the prose takes (§11) |
| `tests/drivers/{name}/` | a driver's side of its kind's conformance suite (§10), and what stands in for its tool: for GitHub's landing driver, the fake GitHub a world carries in its own git directory and the stand-in `gh` and ssh that reach it (`world.cjs`, `gh-stub.cjs`), and the live run (`live-run.cjs`) |

`knowledge-eval*.cjs` and `knowledge-openai-smoke.cjs` sit beside the suites but are tools, not support; so is GitHub's live run, `tests/drivers/github/live-run.cjs`, which no gate runs.

**The rule:** a helper used by two suites moves into the library in the same change, or into its family's module where only that family's suites use it. No suite keeps a file-local copy of a library helper (`readManifest`, `writeFile`, a local `engine` wrapper over `ok`, a local `setupGitFixture`).

**Every remote comes from `bareRepo`.** A hand-written `git init --bare` brings git's auto maintenance back: it starts at the end of every push the remote receives, and outlives the call. `test-engine-harness.cjs` holds the tests to the one bare init.

## 4. Writing a suite

- **One file per contract, named for it:** `test-engine-<family>[-<aspect>].cjs` for a verb family, `test-<kernel-module>.cjs` for a kernel module.
- **The header** is a comment block that names the contract the file pins (the module and its verbs), its layer, and its world. `test-engine-ledger-write.cjs` and `test-engine-layout-hook.cjs` are the model.
- **The first line of code** is `require('./hermetic-env.cjs')`.
- **A unit file touches no git. A verb file defines no world of its own;** it takes one from the library.
- **Split a file when it passes any of these:** ~1,000 lines, ~100 tests, its layer's time budget, or a second subject. Split by aspect, as the ledger suites are (`-write`, `-read`, `-check`, `-affected`, `-since`).
- **`describe` names the subject; `it` names the behaviour,** as a sentence saying what holds: `'move: a question moved to another topic of the unit, the line written field by field'`. Cite the spec line or scenario it pins where one applies: `describe('tags (5.2.3)', …)`.
- **Linters, evals and other tools are modules with their own tests,** never implemented inside a test file.

## 5. Assertions

- **Assert the whole answer of a contract.** `deepStrictEqual` the response and the manifest entry it wrote (the first test of `test-engine-workunit-create.cjs`), not a scatter of `includes`.
- **Every refusal also asserts that nothing was written or committed.**
- **Every absence check names something the code produces elsewhere,** shown by a positive case in the same file. Checking for a name the code never produces proves nothing.
- **An absence check tests one guard.** Where two guards keep something out (the state `.gitignore` and a scoped commit), each gets its own test with the other out of the way.
- **A regex matches only the row it means.** Anchor it to the row's label or its section, so it cannot also hit a sibling row.
- **A test observes the behaviour itself.** "Atomic write" observes the rename, not the absence of a temp file.
- **Each test checks one thing no other test checks.** Before adding one, find the suite that owns the behaviour; if it is pinned there, don't pin it again.
- **A test fails when its behaviour breaks.** Where that isn't plain from reading it, break the code in a scratch copy and watch the test go red.

## 6. Processes, concurrency, time and environment

- **Spawn only where the process is the subject:** the real CLI's streams and exit code, a hook fed stdin, a child that must run concurrently, a script that is not the engine. Everything else goes through the harness in process.
- **A race uses a barrier, never a timed fence.** Each child waits on a file or FIFO, and the test records evidence that the contenders overlapped (how many saw the lock held), failing when they didn't.
- **No wall-clock thresholds.** Bound "waits on a live lock" by the product's own timeout, never by the machine's speed. "Waiting" holds only once the child has shown it reached the wait, never because a `sleep` ran out while it was still starting.
- **Dates come from the frozen clock, never `new Date()`.** An expectation computed from today's date fails across a UTC midnight.
- **A test that changes `process.env` restores it in `finally`,** or passes the change through the call's `env` option instead.
- **Every background job ends on its own.** A spawned child carries a `timeout`; a wait loop gives up after a set number of tries; a server or child a test starts is closed in `after` or `finally`. Nothing polls for something that may never come. The same holds for a builder running gates in the background: `timeout 900 npm test > log 2>&1`.

## 7. Goldens

- **A golden is for a display surface only,** one per surface. Its variants are asserted by structure: sections, rows.
- **About 40 lines at most,** written as the screen reads.
- **Continuations read as indentation,** built with shared row helpers, not `${NB(14)}` spelled inside the text. The row helpers are a library target; today `NB` is defined in five suites.
- **A moved golden is rewritten in the change that moves its surface.** Read the new render against the design before writing it in; never paste a failure's actual output unread. A node golden has no regeneration tool: the diff of the golden is the review.

## 8. Replaced behaviour

A test of replaced behaviour is deleted with that behaviour, in the same change. It is never polished first, never shared or deduplicated, and never kept beside the test of its replacement. A file that loses its last subject goes, and its line in `package.json` with it.

## 9. Migrations

- **One suite per migration,** `test-migration-NNN.cjs`, added to `package.json`'s `test` script.
- **It drives `run()` against a plain temp project** of the shape the migration migrates from, with counting `reportUpdate`/`reportSkip` stubs, never against the live fixture: a frozen migration tested in today's world moves whenever today's world does. It covers the happy path, the skip, idempotency (run twice), content preservation, and every defensive guard. `test-migration-070.cjs` is the model.
- **A released migration's suite is frozen with it.** The `.sh` fleet (001–046) is frozen and runs under `test:migrations`.
- **A directive** is tested through the migration's harness, `migration-world.cjs`: the engine copied beside the real runner and the directives, and a project the migration is under way in, its `leeway-state` with no commit yet. `test-migration-directives.cjs` lints every directive's head (`directive-lint.cjs`) and proves the machinery on the fixture directives in `tests/fixtures/directives/`; a directive's own suite drives its check over that world.

The rules every migration keeps are CLAUDE.md's (Migrations); the module contract is the header of `skills/leeway-migrate/scripts/migrate.cjs`.

## 10. Conformance suites

A conformance suite is the contract a driver meets: one suite per kind of driver, run in the hermetic environment, parametrised over the drivers of that kind.

- **The task suite** covers a phase, links across phases, ready returning several, done unblocking, close and close unblocking, an addition to a task, list and show. The task driver runs against the real tool at or above its declared floor, read through the driver's own `needs`; where none is installed, the suite fails, naming it.
- **The landing suite** covers a task's pull request, a stack, a phase merged — the default branch here then holding it — finish, and a change touching nested repositories, which runs in files of its own for their time: the walk (`test-engine-landing-conformance-nested.cjs`), fix phases stacked on it, one merged as a phase (`test-engine-landing-conformance-stacked.cjs`) and those landed at finish (`test-engine-landing-conformance-stacked-finish.cjs`), and a verb refused in one repository (`test-engine-landing-conformance-nested-refusals.cjs`). The local driver runs fully in the suite; GitHub's runs against a stubbed `gh`, so the developer's `gh` is never reached, and the hermetic environment keeps their login out of every suite — GH_CONFIG_DIR pinned, gh's tokens and host dropped; every suite that reaches `gh` uses that one stub. A live GitHub run happens only on the person's word, on a scratch repository they create for it, under their own login: `node tests/drivers/github/live-run.cjs <owner>/<repo>`, and, given a second empty one, across a submodule as well: `node tests/drivers/github/live-run.cjs <owner>/<repo> <owner>/<sub-repo>`.

A suite names no driver and no tool: it runs against every shipped driver of its kind, and each driver's side of it — readying the world for that driver, naming the environment its calls run under, and reading what it did — is `tests/drivers/{name}/{kind}.cjs`. A new driver joins its kind's suite with its side. What only that driver does — its tool's own calls, how it fails, and what setup sets through it — is a suite beside its side, `tests/drivers/{name}/test-*.cjs`, which may name the tool.

## 11. The pipeline simulation

- **A scenario** replays, in order, the engine calls the skill prose makes for one path through the work.
- **The oracle** runs after every mutation and checks the state across verbs: every manifest parses and is schema-valid, every derivation computes, every gateway and render reads the state and states its menu whole in its gate payload, the ledger holds, and the trust log holds a line for each call, reversal and verdict the ledger and the verdicts given call for, with nothing left waiting in a conversation — after a refusal too.
- **What a verb answers belongs in the verb's suite.** A scenario's calls stay, since each buys the oracle's audit; a scenario never re-asserts a verb's response, its refusal text or its render, which the verb's suite owns.
- **The files:** the oracle is `pipeline-oracle.cjs`; the world, `Sim` and the steps the prose takes are `pipeline-world.cjs`; the scenarios sit in `test-pipeline-simulation-{subject}.cjs`, one file per work type or subject, each within 30 s. A new scenario goes in its work type's or its subject's file, and a file past 30 s splits by subject.

## 12. Measuring

Every change reports the serial time of each suite it touched, before and after:

```bash
uptime
time node --test tests/scripts/test-engine-ledger-write.cjs
```

Run the suites one at a time, and note the load average beside the times: a time compares only with one taken under like load. A suite that passes its layer's budget (§2) is split or made cheaper in the same change: build its world once and copy it, call the engine in process, and run fewer git processes per assertion.

## 13. Prose tests

`tests/prose/` walks the skill prose with real agents (`tests/prose/README.md`). Its corpus went with the switch to the state worktree, and it is rewritten at the end of the build, after manual testing, then run as the clean baseline. There will be far fewer cases than before, possibly none. Nothing in the build relies on prose tests. Until the corpus is rewritten, `npm test`'s prose perimeter (`test-prose-cases.cjs`, `test-prose-snapshots.cjs`) runs over an empty corpus.
