# Contributing

This page is for working **on** the system rather than with it. Most of
the documentation describes the product; this describes the repository
that produces it.

Start by reading `CLAUDE.md` at the repository root — it is the working
brief for anyone, human or agent, changing this codebase, and it covers
architecture, conventions, and the standing rules that are easy to
violate by accident.

## Getting set up

```bash
git clone git@github.com:leeovery/agentic-workflows.git
cd agentic-workflows
npm install
npm test
```

Node 18+. `npm install` pulls dev dependencies only — the product itself
has no runtime dependencies, which is why the knowledge-base CLI ships
as a committed bundle.

## The gates

There is **no automated CI**. The gates run locally, and the convention
is to run them before every commit rather than at the end of a branch.

| Command | What it covers |
| --- | --- |
| `npm test` | Node suites: engine, gateways, knowledge, migrations, pipeline simulation, prose-test perimeter |
| `npm run test:cli` | Shell contract suites: manifest field surface, inbox promotion, knowledge CLI and build |
| `npm run test:migrations` | Every `tests/scripts/test-migration-*.sh` |
| `npm run typecheck` | JSDoc type contracts (`tsc --noEmit`) |

**Never pipe a gate's output.** A pipe swallows the exit code, and a
suite that aborts halfway then reads as green. Redirect to a file and
check `$?` instead. This has produced a falsely-green report before.

## After changing the knowledge base

`src/knowledge/` is bundled into
`skills/workflow-knowledge/scripts/knowledge.cjs` by esbuild. Installs
come from git tags with no build step, so the bundle must be present and
current whenever a tag is cut:

```bash
npm run build   # then commit the bundle alongside the source change
```

## Prose tests

`tests/prose/` walks the skill prose with real agents against real
project states. Walks cost tokens, so they run on command via the
`/prose-test` skill rather than as part of a gate. `npm test` covers only
the token-free perimeter: corpus validation and snapshot rebuilds.

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
  `prose-test snapshots` suite means a world moved. Regenerate with
  `node tests/prose/run.cjs snap <case-id>` and land the snapshot diff in
  the same PR as the change that moved it. Never hand-edit a snapshot.
- **`CHANGELOG.md` is generated.** Never edit it by hand.
- **Shipped `.sh` migrations are frozen.** Fix forward with a new
  numbered `.cjs` migration rather than editing one that has run on real
  installs.

## Conventions

Skill authoring — prose economy, display conventions, file structure,
navigation patterns — lives in `CONVENTIONS.md`, and it is mandatory
reading before editing anything under `skills/`. It is dense and changes
often; skipping it has produced silently non-compliant skills more than
once.

## Raising changes

Open an issue before anything substantial, so the shape can be agreed
before the work. Each idea ships as its own pull request rather than
bundled with others, and any change to engine scripts, adapters,
migrations or `src/knowledge/` lands with its test alongside it.
