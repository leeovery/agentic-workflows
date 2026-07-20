---
name: workflow-migrate
user-invocable: false
---

Migrations run via `engine boot` (`node .claude/skills/workflow-engine/scripts/engine.cjs boot`, called in Step 0 of `workflow-start`) — this skill is never invoked. The directory remains the home of the migration machinery:

- `scripts/migrate.cjs` — orchestrator: runs every `scripts/migrations/` script (`*.sh` and `*.cjs`) in one numeric-prefix ordering, tracks progress in `.workflows/.state/migrations`, reports update counts.
- `scripts/migrations/NNN-*.{sh,cjs}` — the migration scripts, each idempotent.

The conversational surface (change summary, review gate, commit) lives in `workflow-start` Step 0.
