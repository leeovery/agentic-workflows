# Resume Detection

*Shared reference for processing skills.*

---

Read `{file}`.

**If `artifact` is `research`, `discussion`, or `investigation`**, read the topic's mailbox — `node .claude/skills/workflow-engine/scripts/engine.cjs topic mailbox {work_unit} {artifact} {topic}`. When `count` is non-zero, the entries are messages other topics sent here — their origin sessions recorded them as sent. Restart preserves the mailbox (it is not a restart target), but the count belongs in the gate: set `{N}` = `count` and pass `--mail {N}` below. Omit the flag when the count is zero or the artifact has no mailbox.

Render the gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render resume-gate {work_unit}.{artifact}.{topic} [--mail {N}]
```

Emit each returned section verbatim per its marker — the mail warning (when present) directly above the menu.

**STOP.** Wait for user response.

#### If `continue`

→ Return to caller for **{continue_step}**. The steps before it are the fresh path's — the artifact's existence means they already ran.

#### If `restart`

1. Delete {restart_targets}
2. Reset {restart_resets} — only when the caller passed `restart_resets`; skip otherwise. Deleting artifacts while their manifest tracking rows stay satisfied would leave the fresh run believing that work already happened.
3. Commit the deletions and the reset on the topic's own scope:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic {artifact}/{topic} -m "{commit}"
   ```

→ Return to caller for **Step 1**.
