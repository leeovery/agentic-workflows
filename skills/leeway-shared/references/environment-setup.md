# The Environment Setup

*Shared reference. Loaded by the specification at the project's first ready to build, with from = `ready to build`, and by the start menu at a Comment on manage's setup, with from = `manage`.*

---

The project's environment setup: how to run the product, the steps that prepare the environment, what can't run at once and the linters. It is asked once, at the project's first ready to build, and changed from manage after. The verify setup is never set here: the task that builds it records it.

## The Parts

At ready to build, read the repository for how to run the product, what a fresh checkout needs before it builds and tests, and the linters the project runs, and record each part found before the screen. From manage, set each part the person's Comment changes. A part is written whole, its JSON on stdin:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs environment set {part:[run|prepare|linters]}
```

- **run** — `{"build", "tests", "run"}`, each a command, any the project lacks left out. The commit door runs `tests`, then each linter, before every code commit.
- **prepare** — `[{"name", "when", "command"}, …]`: env files, keys, dependencies, a test database. `when` is `first`, once before the build's first task; `worktree`, in each worktree a task runs in; or `both`. A worktree already holds what `.worktreeinclude` names and the directories Claude Code links. The engine runs each command as written, so a step no command does — a key the person fetches — is `{"name", "when", "note"}`, shown and never run.
- **linters** — `[{"name", "command"}, …]`.

What can't run at once is recorded by a build as it learns it: leave it to the builds.

## The Screen

Draw it — again, from manage, `--from manage` — and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render environment-setup [--from manage]
```

The answer goes to `gate`; follow its `next`. A Comment says what's different: set each part it changes, then draw the screen again.
