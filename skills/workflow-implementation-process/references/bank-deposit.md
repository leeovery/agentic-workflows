# Bank Deposit

*Reference for **[task-loop.md](task-loop.md)** — loaded when the task's `do_banking` is `true`.*

---

Every report that carries BANK entries deposits them the moment it arrives, whatever its STATUS or verdict — the phase's boundary pass decides them, and the pushes ride the next commit that stages the manifest. A near-duplicate of an earlier round's entry is fine; the pass folds them. A report carrying no BANK section deposits nothing. Push each entry:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.implementation.{topic} bank '{"task":"{internal_id}","source":"{source}","summary":"{one line}","detail":"{what and where, file:line}","files":["{path}"]}'
```

→ Return to caller.
