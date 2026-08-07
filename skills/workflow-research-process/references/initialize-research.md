# Initialize Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

## A. Read the Phase Inputs

The durable inputs live in the manifest and at fixed paths — read them here; the handoff never carries them.

#### If the handoff carries `Source: existing research`

A restart — skip the reads; the session gathers context naturally.

→ Proceed to **B. Create and Register**.

#### Otherwise

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

→ Load **[read-brief-context.md](../../workflow-shared/references/read-brief-context.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`.

**If `work_type` is not `epic`:**

The carrier discovery left has two halves — read both. First the manifest `description`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} description
```

Then the discovery session log's **Exploration** — single-phase work has exactly one log, at `.workflows/{work_unit}/discovery/sessions/session-001.md`. A legacy work unit may have no log, or a placeholder whose **Exploration** is absent or `(none)`.

→ Proceed to **B. Create and Register**.

**Otherwise:**

The brief just read is the carrier — nothing more to read here.

→ Proceed to **B. Create and Register**.

## B. Create and Register

The inputs just read are inherited ground, not a list of questions to re-ask. Exploring adjacent territory is this phase's job; putting a decision discovery already reached back to the user as an open question is not. Where exploration turns up something that genuinely undercuts one, surface that as a finding rather than reopening the decision.

1. Load **[template.md](template.md)** — use it to create the research file at the Output path from the handoff (e.g., `.workflows/{work_unit}/research/{resolved_filename}`). When the file already exists, keep its content and write the template's working sections around it.
2. Populate the Starting Point section from whatever seeded this phase: the handoff's `Context:` fields when the interview ran, otherwise the inputs read at **A** and anything the user said in the conversation that launched this session. When restarting (**A** was skipped), leave the section empty.
3. Register in manifest:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} research {topic}
   ```
4. Commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic research/{topic} -m "research({work_unit}): initialize {topic} research"
   ```

→ Return to caller.
