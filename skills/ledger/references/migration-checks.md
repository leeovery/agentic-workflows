# Migration Checks

*Reference for **[ledger](../SKILL.md)***

---

The migration stopped before its move into Ledger: earlier migrations handed back checks their code could not make, and the move reads the files some of them fix, so the checks come first.

1. **Each entry in `verify`** is a migration the run carried out. Its `info` says what the migration does in any project; its `verify` says what to check in this one. Perform each entry's checks with judgment where its `verify` says, and fix what you find. What it asks of the old state, check and fix in `{folder}/.workflows/` — the main checkout's copy, which the move reads, wherever this session runs — and leave every fix there uncommitted: the move carries it into the state. What it asks of the knowledge base — indexing a file again, removing chunks — needs nothing: boot builds a new store from the moved records. What it asks of the summary, the review at the migration's end writes: it lists each check made here among what was done.
2. Record the checks made, so the migration carries on past them:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs migrate checked
```

→ Return to caller.
