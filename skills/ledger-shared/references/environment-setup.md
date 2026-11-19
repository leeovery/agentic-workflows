# The Environment Setup

*Shared reference. Loaded by the specification at the project's first ready to build, with from = `ready to build`, and by the start menu at a Comment on manage's setup, with from = `manage`.*

---

The project's environment setup: how to run the product, the steps that prepare the environment, what can't run at once and the linters. It is asked once, at the project's first ready to build, and changed from manage after.

## The Parts

Read what is recorded first:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs environment show
```

At ready to build, start from what is recorded and read the repository for what it lacks: how to run the product, what a fresh checkout needs before it builds and tests, and the linters the project runs. A *From before Ledger* note in prepare is the setup the project kept before Ledger: turn what it says into the parts, a note only for a step no command does, and record prepare without it. Record each part found before the screen. From manage, set each part the person's Comment changes. A part is written whole, its JSON on stdin:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs environment set {part:[run|prepare|concurrency|linters]}
```

- **run** — `{"build", "tests", "run"}`, each a command, any the project lacks left out. The commit door runs `tests`, then each linter, before every code commit.
- **prepare** — `[{"name", "when", "command"}, …]`: env files, keys, dependencies, a test database. `when` is `first`, once before the build's first task; `worktree`, in each worktree a task or its tests run in; or `both`. A worktree already holds what `.worktreeinclude` names and the directories Claude Code links. The engine runs each command as written, so a step no command does — a key the person fetches — is `{"name", "when", "note"}`, shown and never run.
- **concurrency** — `[{"what"}, …]`, each thing two runs can't share at once, such as a port or a database. A build records each as it learns it; set the part only where the person changes it.
- **linters** — `[{"name", "command", "fix"}, …]`, `fix` the command that mends what the linter finds, left out where it has none.

## The Screen

Draw it, from manage with `--from manage`:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render environment-setup [--from manage]
```

A Comment says what's different: set each part it changes, then draw the screen again.
