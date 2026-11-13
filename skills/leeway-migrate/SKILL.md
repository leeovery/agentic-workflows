---
name: leeway-migrate
user-invocable: false
---

Migrations run via `engine boot` (`node .claude/skills/leeway-engine/scripts/engine.cjs boot`, called in Step 0 of `leeway`) — this skill is never invoked. The directory remains the home of the migration machinery:

- `scripts/migrate.cjs` — the runner: runs every migration in `scripts/migrations/` (`*.sh`, `*.cjs`, and the directives, `*.md` with their checks) in one numeric-prefix ordering, records each in `.leeway/.state/migrations`, stops at a directive the start session carries out, and reports update counts.
- `scripts/migrations/NNN-*` — the migrations, each idempotent.
- `scripts/reshape.cjs` — what the reshape's migration knows of a project from before Leeway: whether it is owed, and the state worktree put in place for it.

The conversational surface (change summary, review gate, commit, a directive carried out) lives in `leeway` Step 0.
