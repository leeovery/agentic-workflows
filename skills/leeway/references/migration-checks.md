# Migration Checks

*Reference for **[leeway](../SKILL.md)***

---

The migration stopped before its move into Leeway: earlier migrations handed back checks their code could not make on `.workflows/`, or notices for the person. The move reads those files next, so the checks come first.

1. **Each entry in `verify`** is a migration the run carried out. Its `info` says what the migration does in any project; its `verify` says what to check in this one. Perform each entry's checks with judgment against the files in `{folder}/.workflows/` — the main checkout's copy, which the move reads, wherever this session runs — and fix what you find there. Leave every fix uncommitted: the move carries it into the state. What an entry asks of the knowledge base — indexing a file again, removing chunks — needs nothing: boot builds a new store from the moved records.
2. **Each entry in `notices`** is a sentence for the person: tell them each.
3. Record the checks made, so the migration carries on past them:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs migrate checked
```

→ Return to caller.
