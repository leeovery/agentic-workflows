# Contributing

This page is for working **on** the system rather than with it. Most of
the documentation describes the product; this describes the repository
that produces it.

Start by reading `CLAUDE.md` at the repository root — the standing rules
for working on this repository that are easy to violate by accident, a
short map of the system, and the documents that own each part. How the
system behaves lives in the skills themselves, the engine's command
reference (`skills/workflow-engine/references/commands.md`), the module
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
| `npm run test:cli` | Shell contract suites: the manifest field surface and the `engine knowledge` surface | shell, closing into verb |
| `npm run test:migrations` | Every `tests/scripts/test-migration-*.sh` | migration (the frozen fleet) |
| `npm run typecheck` | JSDoc type contracts (`tsc --noEmit`) | — |
| `npm run test:mod` | Both gate mods' suites (`workflow-gates` and `workflow-gates-rows`) under `claude plugin test` — owed for any change under `skills/workflow-gates*/` | the mods' own |

What each layer holds, and how a test in it is written, is `tests/README.md`.

The mods need Claude Code 2.1.287 or newer; a change that relies on a newer Claude Code raises that floor in the same PR.

**Never pipe a gate's output.** A pipe swallows the exit code, and a
suite that aborts halfway then reads as green. Redirect to a file and
check `$?` instead. This has produced a falsely-green report before.

## After changing the knowledge base

The knowledge base is engine code — its mechanism in
`skills/workflow-engine/scripts/kernel/knowledge/`, its workflow side in
`skills/workflow-engine/scripts/domain/knowledge/`. The kernel holds the
store's file format, the tokenizer and stemmer, ranking, chunking,
excerpts and outlines, the embedding providers and the config; the domain
side holds artifact identity against the manifests, indexing, the vector
fill, query and the passages it prints, status, decay, setup, and
`commands.cjs`, the `engine knowledge` door; the per-phase chunking
configs sit in `skills/workflow-engine/content/knowledge/chunking/`. Each
module's header states its contract. The modules take no dependencies:
Node's built-ins alone, none newer than Node 18.

A change that moves retrieval re-pins the eval baseline in the same PR, so
the diff carries the before and after:

```bash
node tests/scripts/knowledge-eval.cjs --pin
```

## Writing a migration

Migrations bring an existing project's `.workflows/` forward to the
current design; `engine boot` runs them at `/workflow-start`. The rules
every migration keeps are CLAUDE.md's (Migrations). The orchestrator's
header (`skills/workflow-migrate/scripts/migrate.cjs`) states the module
contract — `id`, `description`, `run`, the report callbacks, the optional
verification addendum and notice.

- A new migration is
  `skills/workflow-migrate/scripts/migrations/NNN-description.cjs`, the
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

Skill authoring — prose economy, display conventions, file structure,
navigation patterns — lives in `CONVENTIONS.md`, and it is mandatory
reading before editing anything under `skills/`. It is dense and changes
often; skipping it has produced silently non-compliant skills more than
once.

## Raising changes

Open an issue before anything substantial, so the shape can be agreed
before the work. Each idea ships as its own pull request rather than
bundled with others, and any change to engine scripts (the knowledge
base's among them), adapters, migrations or the gate mods lands with its
test alongside it. A change to what the system does describes itself in
its pull request and in this book.
