---
name: ledger-migrate
user-invocable: false
---

Migrations run via `engine boot` (`node .claude/skills/ledger-engine/scripts/engine.cjs boot`, the first thing `ledger` runs) — this skill is never invoked. The directory remains the home of the migration machinery:

- `scripts/migrate.cjs` — the runner: runs every migration in `scripts/migrations/` (`*.sh`, `*.cjs`, and the directives, `*.md` with their checks) in one numeric-prefix ordering, records each in `.ledger/.state/migrations`, stops at a directive the start session carries out, and before the reshape's move for the checks the chain before it handed back, and reports update counts.
- `scripts/migration-ids.cjs` — how a migration is named, which the runner and the engine both ask: a file's id, whether it is a migration, and the highest installed, the version boot's stamp names.
- `scripts/migrations/NNN-*` — the migrations, each idempotent.
- `scripts/migrations/reshape/` — what the reshape's released steps share, the state worktree put in place among it: frozen with them.
- `scripts/record-files.cjs` — the files a topic's record is kept in as the records directive composes, verifies and carries it, which its check and the engine's carry both read: frozen with that directive.
- `scripts/old-layout.cjs` — what the runner and the engine know of a project from before Ledger: whether it owes the reshape or has it under way, and what a checkout other than the main one holds that the reshape leaves where it is.

The conversational surface (change summary, review gate, commit, a directive carried out, the checks before the move) lives in `ledger`, at boot's stops and the migration review.
