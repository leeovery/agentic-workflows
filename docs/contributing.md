# Contributing

This page is for working **on** Ledger rather than with it. Most of
the documentation describes the product; this describes the repository
that produces it.

Start by reading `CLAUDE.md` at the repository root — the standing rules
for working on this repository that are easy to violate by accident, a
short map of Ledger, and the documents that own each part. How
Ledger behaves lives in the skills themselves, the engine's command
reference (`skills/ledger-engine/references/commands.md`), the module
header comments, and this book.

## Getting set up

```bash
git clone git@github.com:leeovery/agentic-workflows.git
cd agentic-workflows
npm install
npm test
```

The product runs on Node 18 or newer; the suites need Node 20.11 or newer,
since several mock the clock's `Date`. `npm install` pulls dev dependencies
only — the product itself has no runtime dependencies and nothing to build:
it installs as committed.

The suites of the task verbs drive the real tracker: install Tick, the task
driver's tool, before `npm test`. A stand-in first on the harness's `PATH`
(`tests/drivers/tick/bin/tick`) answers only `tick version`, at the floor
the driver needs or the one a suite sets, and hands every other command to
the Tick on your machine.

## The gates

There is **no automated CI**. The gates run locally, and the convention
is to run them before every commit rather than at the end of a branch.

| Command | What it covers | Layers |
| --- | --- | --- |
| `npm test` | Node suites: engine, drivers, knowledge, migrations, pipeline simulation, prose-test perimeter, and the checks on the docs, the glossary and where a tool may be named; ends with the budget report, the run's CPU against its guide (`tests/README.md` §12) | unit, verb, git, process, simulation, migration (047 on), prose |
| `npm run test:cli` | The shell contract suite of the manifest field surface | shell, closing into verb |
| `npm run test:migrations` | Every `tests/scripts/test-migration-*.sh` | migration (the frozen fleet) |
| `npm run typecheck` | JSDoc type contracts (`tsc -p tsconfig.json`) | — |
| `npm run test:mod` | Both gate mods' suites (`ledger-gates` and `ledger-gates-rows`) under `claude plugin test` — owed for any change under `skills/ledger-gates*/` | the mods' own |

What each layer holds, and how a test in it is written, is `tests/README.md`.

The mods need Claude Code 2.1.287 or newer; a change that relies on a newer Claude Code raises that floor in the same PR. The engine needs git 2.40.0 or newer; a change that runs a git command or option a newer git brought raises that floor in the same PR.

**Never pipe a gate's output.** A pipe swallows the exit code, and a
suite that aborts halfway then reads as green. Redirect to a file and
check `$?` instead. This has produced a falsely-green report before.

## After changing the knowledge base

The knowledge base is engine code — its mechanism in
`skills/ledger-engine/scripts/kernel/knowledge/`, its workflow side in
`skills/ledger-engine/scripts/domain/knowledge/`. The kernel holds the
store's file format, the tokenizer and stemmer, ranking, chunking,
excerpts and outlines, the embedding providers and the config; the domain
side holds what is indexed and each artifact's identity, indexing, the
vector fill, query and the passages it prints, status, decay, setup, and
`commands.cjs`, the `engine knowledge` door; the chunking configs, one for
the records and one for a quick-fix's short record, sit in
`skills/ledger-engine/content/knowledge/chunking/`. Each
module's header states its contract. The modules take no dependencies:
Node's built-ins alone, none newer than Node 18.

A change that moves retrieval re-pins the eval baseline in the same PR, so
the diff carries the before and after:

```bash
node tests/scripts/knowledge-eval.cjs --pin
```

## Writing a migration

Migrations bring an existing project's state forward to the current
design; `engine boot` runs them at `/ledger`. The rules
every migration keeps are CLAUDE.md's (Migrations). The orchestrator's
header (`skills/ledger-migrate/scripts/migrate.cjs`) states the module
contract — `id`, `description`, `run`, the report callbacks, the optional
verification addendum and notice.

- A new migration is
  `skills/ledger-migrate/scripts/migrations/NNN-description.cjs`, the
  next number after the highest. The `*.sh` files are the frozen fleet:
  nothing new is written in bash.
- Three migrations write outside the project. 061 moves each tmux
  label's resume position into its conversation's folder at user level.
  066 edits the user's own Claude Code settings, and its verification
  addendum names the change, since the review diff cannot show it. 078
  moves the user-level folder to `~/.config/ledger/`, leaving a link to it
  in its place.
- Its suite is `tests/scripts/test-migration-NNN.cjs`, registered in
  `package.json`'s `test` script. Like its siblings it drives `run()`
  against a temp `projectDir` with counting `reportUpdate`/`reportSkip`
  stubs, and covers the happy path, the skip, idempotency (run twice),
  content preservation, and every defensive guard.

A **directive** is a migration whose work is judgment: the runner stops
at it, and the start session carries it out. The same header states its
format and its check's contract.

- A directive is `migrations/NNN-slug.md` in the same sequence, its head
  first: its title, then `## Touches`, the files it may touch, and
  `## Asks`, what it asks the person (`- Nothing.` where it asks
  nothing), each a list alone, an item wrapped onto indented lines;
  its instructions follow under headings of their own. It names the
  roster's agents, never a model or an effort.
- Its check sits beside it, `NNN-slug.check.cjs`, exporting
  `{ counts, done, check({ projectDir, stateDir }) }`: what one of its
  pieces is called and many (`{ one: 'topic', many: 'topics' }`), what
  a piece done has (`'have their records'`), and each piece with what
  it still lacks. The stop's screen says them as "12 of Larkspur's 19
  topics have their records". `engine migrate check` runs it; the
  directive is recorded only when
  `engine checklist close directive NNN-slug` finds it passing, or by
  the runner, unrun, where its check answers no piece at all: there is
  nothing for the session to do, and the line `NNN unrun` beside its own
  keeps it out of the review's directives done.
- `tests/scripts/test-migration-directives.cjs` lints every directive's
  head and holds its check beside it; a directive's own suite drives its
  check over a project the migration is under way in
  (`tests/scripts/migration-world.cjs`).

The **reshape** — the migration from a project's `.workflows/`, from
before Ledger, to `.ledger/` — keeps a contract of its own in the runner, stated
in the same header:

- Whether a project owes it is `skills/ledger-migrate/scripts/old-layout.cjs`'s
  to answer (`owed`): its `.workflows/` on the main checkout's code
  branch, and no commit on `ledger-state`. The engine and the runner ask
  it there, so no engine module names the old layout.
- Where the run's record holds no line, the old record,
  `.workflows/.state/migrations`, seeds it, written whole, so a project
  part-way through the existing chain runs the rest of it, never the
  whole fleet again.
- The reshape's guard (074) runs first, before the existing chain, while
  it is unrecorded and the reshape is owed: its check for uncommitted
  changes sees only the person's. It alone may refuse: a refusal prints
  `---REFUSED: 074---` and the refusal's facts, records nothing, and
  boot stops there. On a pass it puts the state worktree in place
  (`migrations/reshape/shared.cjs`, `placeStateWorktree`), so every step
  after it runs while the migration runs.
- Boot runs the reshape's run in the project's folder in the main
  checkout, the copy the move reads, wherever it was called from. Called
  from another checkout, it warns of each file of that checkout's
  `.workflows/` that differs from the main checkout's and stays where it
  is (`old-layout.cjs`, `unmoved`).
- `migrations/reshape/` is what the reshape's released steps share: it is
  frozen with them, and holds its own reading of the layout. The
  runtime's is `old-layout.cjs`, free to change. Neither loads the other.
- Where the chain before the guard hands back checks, the runner stops
  before the move reads `.workflows/`, and boot answers `checks`: the
  session makes each check where it says — the old state's on the main
  checkout's `.workflows/`, uncommitted — and records them made with
  `engine migrate checked`, a line in the migrations record, as a
  directive's close is. The next run marks them `made` in their journal,
  and the review at the migration's end lists them among what was done.
  The chain's notices never stop it: they wait for that review.
- No migration loads the engine: each task driver's folder declares where
  a project from before Ledger kept its tracker's store as data,
  `pre-ledger-store.json`, which the reshape's steps read with fs alone,
  and a folder whose declaration is missing or does not read is named in
  their notice.
- The engine's verbs only the migration's directives call — `ledger
  carry`, `workunit split`, `workunit retire`, `cut --migrating`, `task
  adopt` and `task close-plan` — refuse once the state branch has its
  first commit (`state-worktree.cjs`, `assertMigrationRuns` and
  `migrationRuns`), and each finishes on a redo of a run killed part-way.
- The reshape's finish (081) journals the code side's drops —
  `.workflows/` and each declared store — in the state's cache,
  `.ledger/.cache/migrate/finish.json`, `{drops}`, staging nothing, so
  the engine names neither and a commit of the person's own takes none of
  them. Boot then answers `finish`, committing nothing, and the
  migration's commit, `engine commit --migrations` on the person's yes,
  makes the state branch's first commit, then the code branch's, taking
  the drops out through its own index, and takes them out of the
  person's index and off disk (`domain/migration-commit.cjs`); boot does
  that last part itself where a kill after the code commit left it, and
  relinks the state worktree where the project folder moved meanwhile.
  Until that commit, a run that completes keeps the handbacks it
  journaled, so every boot's review reads them.

## Prose tests

`tests/prose/` walks the skill prose with real agents against real
project states, through the `/prose-test` skill; when walks run, and what
a change owes the corpus, are CLAUDE.md's rules (Prose tests). `npm test`
covers only the token-free perimeter: corpus validation and snapshot
rebuilds.

**Prerequisite that will otherwise waste your afternoon:** the walker
records what it did through a `PostToolUse` hook declared in its own
agent frontmatter, and **frontmatter hooks in a project subagent only
run once the workspace trust dialog has been accepted for the folder**
(Claude Code 2.1.218+). Until then they fail *silently* — no warning, no
error, and `/hooks` shows nothing for an agent that isn't currently
active. The symptom is every prose-test run reporting `HARNESS ERROR`
with no action log.

Check it directly:

```bash
node -e 'const o=require(process.env.HOME+"/.claude.json");
  console.log(o.projects[process.cwd()]?.hasTrustDialogAccepted)'
```

If that prints `false`, accept the trust dialog for the folder. Note that
`hasCompletedProjectOnboarding` can be `true` while trust is still
`false` — onboarding predates the change that started gating hooks on
it, so an old checkout will look set up and quietly not be.

## Known hiccups

- **Agent and skill definitions are cached per session.** Editing
  `.claude/agents/*.md` and immediately testing will exercise the old
  definition. Reload plugins, or restart, before trusting a result.
- **Snapshot drift is expected after an engine change.** A red
  `prose-test snapshots` suite means a world moved: regenerate it with
  `node tests/prose/run.cjs snap <case-id>` and land the snapshot's diff in
  the same commit as the change that moved it (the suite's header,
  `tests/scripts/test-prose-snapshots.cjs`).
- **`CHANGELOG.md` is generated** — CLAUDE.md (Changelog).
- **Released migrations are frozen** — CLAUDE.md (Migrations).

## The docs

`docs/` is the book, and `README.md` its pitch. The book is written from the
shipped skills and engine, which are the source of truth: a change to what
Ledger does describes itself in the chapter that covers it. Four suites
hold what can be checked:

- `tests/scripts/test-docs.cjs` — the chapters the book is made of, with no
  `planning.md` and no collaboration chapter apart from trust; the main
  session's recommended minimum effort, medium, stated; the README's pipeline
  table naming no retired phase; every link going to its file and heading;
  none of the author's own products and projects named, only described; and
  the product called Ledger, in the docs, the README, help and the glossary,
  never by an old name — the one it had while it was built, or the one the
  glossary's avoid line keeps — which only `history.md` and that line may
  say.
- `tests/scripts/test-tool-names.cjs` — a tool a driver wraps named only
  where CLAUDE.md's Tool Names allows: the docs and `README.md` may name
  one, help and the glossary never.
- `tests/scripts/test-glossary.cjs` — the glossary's terms, the vocabulary
  the docs share with the screens.
- `tests/scripts/test-git-floor.cjs` — the git the README, the
  configuration chapter and this page say Ledger needs, held to the
  engine's own floor.

## Conventions

Skill authoring — where each rule goes, what a phase skill holds, prose,
display and the design system, file structure — lives in
`CONVENTIONS.md`, and it is mandatory reading before editing anything
under `skills/`. It is dense and changes often; skipping it has produced
silently non-compliant skills more than once.

## Moving to a new model

When Ledger moves to a new model, the prose is walked on it and one
pass cuts what that model no longer needs. Beyond the prose, the pass
re-weighs each item below, each held as it is for today's model:

- the brief templates in the engine's content folder
  (`skills/ledger-engine/content/briefs/`);
- the checklist items held for the model: a topic's close's "every
  decision in the conversation has an entry", and the closing pass's
  second reader;
- the reviewer count (`kernel/reviewers.cjs` in the engine);
- the model lines the ask rule's counts pass down
  (`domain/trust-counts.cjs` in the engine): the new model goes last in
  its line, or into a line of its own where it starts from none of the
  person's counts — until it is listed, it reads as the first line's next;
- the effort threshold;
- the raw calls' models and efforts: the one-decision check, the
  labeller, and the typed-answer reader;
- the one-decision check's hit rate, read from its log,
  `~/.config/ledger/decision-checks.jsonl`: a line per run, across every
  project, with its outcome (`one`, `several`, or `unchecked` where the
  call could not judge) and how many rules it found;
- the knowledge eval's hybrid mode (`--hybrid`), the embedding index
  beside the words.

## Raising changes

Open an issue before anything substantial, so the shape can be agreed
before the work. Each idea ships as its own pull request rather than
bundled with others, and any change to engine scripts (the knowledge
base's among them), adapters, migrations or the gate mods lands with its
test alongside it. A change to what Ledger does describes itself in
its pull request and in this book.
