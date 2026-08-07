# Initialize Investigation

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

## A. Read the Phase Inputs

The durable inputs live in the manifest and at fixed paths — read them here; the handoff never carries them.

The carrier discovery left has two halves — read both. First the manifest `description`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} description
```

Then the discovery session log's **Exploration** — single-phase work has exactly one log, at `.workflows/{work_unit}/discovery/sessions/session-001.md`. A logless bugfix has none.

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

→ On return, proceed to **B. Create and Register**.

## B. Create and Register

1. Create the investigation directory: `.workflows/{work_unit}/investigation/`
2. Load **[template.md](template.md)** — use it to create `.workflows/{work_unit}/investigation/{topic}.md`
3. Populate the Symptoms section from the inputs just read, the handoff's `Bug context:` when the interview ran, and anything already in conversation
4. Register investigation in manifest:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} investigation {topic}
   ```
5. Commit the initial file

→ Return to caller.
