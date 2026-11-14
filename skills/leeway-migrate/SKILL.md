---
name: leeway-migrate
user-invocable: false
---

Migrations run via `engine boot` (`node .claude/skills/leeway-engine/scripts/engine.cjs boot`, called in Step 0 of `leeway`) — this skill is never invoked. The directory remains the home of the migration machinery:

- `scripts/migrate.cjs` — the runner: runs every migration in `scripts/migrations/` (`*.sh`, `*.cjs`, and the directives, `*.md` with their checks) in one numeric-prefix ordering, records each in `.leeway/.state/migrations`, stops at a directive the start session carries out, and reports update counts.
- `scripts/migration-ids.cjs` — how a migration is named, which the runner and the engine both ask: a file's id, whether it is a migration, and the highest installed, the version boot's stamp names.
- `scripts/migrations/NNN-*` — the migrations, each idempotent.
- `scripts/migrations/reshape/` — what the reshape's released steps share, the state worktree put in place among it: frozen with them.
- `scripts/old-layout.cjs` — what the runner and the engine know of a project from before Leeway: whether it owes the reshape, and what a checkout other than the main one holds that the reshape leaves where it is.

The conversational surface (change summary, review gate, commit, a directive carried out) lives in `leeway` Step 0.
