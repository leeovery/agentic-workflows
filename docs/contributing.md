# Contributing

This page is for working **on** the system rather than with it. Most of
the documentation describes the product; this describes the repository
that produces it.

Start by reading `CLAUDE.md` at the repository root — the standing rules
for working on this repository that are easy to violate by accident, a
short map of the system, and the documents that own each part. How the
system behaves lives in the skills themselves, the engine's command
reference (`skills/leeway-engine/references/commands.md`), the module
header comments, and this book.

## Getting set up

```bash
git clone git@github.com:leeovery/agentic-workflows.git
cd agentic-workflows
npm install
npm test
```

Node 18+. `npm install` pulls dev dependencies only — the product itself
has no runtime dependencies and nothing to build: it installs as
committed.

## The gates

There is **no automated CI**. The gates run locally, and the convention
is to run them before every commit rather than at the end of a branch.

| Command | What it covers | Layers |
| --- | --- | --- |
| `npm test` | Node suites: engine, gateways, knowledge, migrations, pipeline simulation, prose-test perimeter | unit, verb, git, process, simulation, migration (047 on), prose |
| `npm run test:cli` | The shell contract suite of the manifest field surface | shell, closing into verb |
| `npm run test:migrations` | Every `tests/scripts/test-migration-*.sh` | migration (the frozen fleet) |
| `npm run typecheck` | JSDoc type contracts (`tsc --noEmit`) | — |
| `npm run test:mod` | Both gate mods' suites (`leeway-gates` and `leeway-gates-rows`) under `claude plugin test` — owed for any change under `skills/leeway-gates*/` | the mods' own |

What each layer holds, and how a test in it is written, is `tests/README.md`.

The mods need Claude Code 2.1.287 or newer; a change that relies on a newer Claude Code raises that floor in the same PR. The engine needs git 2.40.0 or newer; a change that runs a git command or option a newer git brought raises that floor in the same PR.

**Never pipe a gate's output.** A pipe swallows the exit code, and a
suite that aborts halfway then reads as green. Redirect to a file and
check `$?` instead. This has produced a falsely-green report before.

## After changing the knowledge base

The knowledge base is engine code — its mechanism in
`skills/leeway-engine/scripts/kernel/knowledge/`, its workflow side in
`skills/leeway-engine/scripts/domain/knowledge/`. The kernel holds the
store's file format, the tokenizer and stemmer, ranking, chunking,
excerpts and outlines, the embedding providers and the config; the domain
side holds artifact identity against the manifests, indexing, the vector
fill, query and the passages it prints, status, decay, setup, and
`commands.cjs`, the `engine knowledge` door; the per-phase chunking
configs sit in `skills/leeway-engine/content/knowledge/chunking/`. Each
module's header states its contract. The modules take no dependencies:
Node's built-ins alone, none newer than Node 18.

A change that moves retrieval re-pins the eval baseline in the same PR, so
the diff carries the before and after:

```bash
node tests/scripts/knowledge-eval.cjs --pin
```

## Writing a migration

Migrations bring an existing project's `.workflows/` forward to the
current design; `engine boot` runs them at `/leeway`. The rules
every migration keeps are CLAUDE.md's (Migrations). The orchestrator's
header (`skills/leeway-migrate/scripts/migrate.cjs`) states the module
contract — `id`, `description`, `run`, the report callbacks, the optional
verification addendum and notice.

- A new migration is
  `skills/leeway-migrate/scripts/migrations/NNN-description.cjs`, the
  next number after the highest. The `*.sh` files are the frozen fleet:
  nothing new is written in bash.
- Migration 066, which edits the user's own Claude Code settings, is the
  one migration that writes outside the project; its verification
  addendum names the change, since the review diff cannot show it.
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
  it still lacks. The stop's screen says them as "12 of Fumi's 19
  topics have their records". `engine migrate check` runs it; the
  directive is recorded only when
  `engine checklist close directive NNN-slug` finds it passing.
- `tests/scripts/test-migration-directives.cjs` lints every directive's
  head and holds its check beside it; a directive's own suite drives its
  check over a project the migration is under way in
  (`tests/scripts/migration-world.cjs`).

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
  `prose-test snapshots` suite means a world moved; CLAUDE.md (Prose
  tests) says how it is regenerated.
- **`CHANGELOG.md` is generated** — CLAUDE.md (Changelog).
- **Released migrations are frozen** — CLAUDE.md (Migrations).

## Conventions

Skill authoring — where each rule goes, what a phase skill holds, prose,
display and the design system, file structure — lives in
`CONVENTIONS.md`, and it is mandatory reading before editing anything
under `skills/`. It is dense and changes often; skipping it has produced
silently non-compliant skills more than once.

## Moving to a new model

When the workflows move to a new model, the prose is walked on it and one
pass cuts what that model no longer needs. Beyond the prose, the pass
re-weighs each item below, each held as it is for today's model:

- the brief templates in the engine's content folder
  (`skills/leeway-engine/content/briefs/`);
- the checklist items held for the model: a topic's close's "every
  decision in the conversation has an entry", and the closing pass's
  second reader;
- the habit-hook entries;
- the reviewer count;
- the effort threshold;
- the raw calls' models and efforts: the one-decision check, the
  labeller, and the typed-answer reader;
- the one-decision check's hit rate;
- the knowledge eval's index arm.

## Raising changes

Open an issue before anything substantial, so the shape can be agreed
before the work. Each idea ships as its own pull request rather than
bundled with others, and any change to engine scripts (the knowledge
base's among them), adapters, migrations or the gate mods lands with its
test alongside it. A change to what the system does describes itself in
its pull request and in this book.
