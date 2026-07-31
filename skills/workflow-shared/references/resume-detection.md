# Resume Detection

*Shared reference for processing skills.*

---

Read `{file}`.

**If the topic's triage queue holds entries** (`.triage/{topic}/*.md` beside the artifact — research and discussion only): they are concerns rerouted here from other topics — their origin sessions recorded them as landed. Restart preserves the queue (it is not a restart target), but the count belongs in the gate. Set `{N}` = the count of queue files and pass `--triage {N}` below; omit the flag otherwise.

Render the gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render resume-gate {work_unit}.{artifact}.{topic} [--triage {N}]
```

Emit each returned section verbatim at its marked instruction — the triage warning (when present) directly above the menu.

**STOP.** Wait for user response.

#### If `continue`

→ Return to caller for **{continue_step}**.

#### If `restart`

1. Delete {restart_targets}
2. Reset {restart_resets} — only when the caller passed `restart_resets`; skip otherwise. Deleting artifacts while their manifest tracking rows stay satisfied would leave the fresh run believing that work already happened.
3. Commit: `{commit}`

→ Return to caller for **Step 1**.
