# Conclude

*Reference for **[workflow-roadmap](../SKILL.md)***

---

Close the session and return to the home. Stopping here is first-class — a harvested roadmap with zero work units is a complete outcome, banked and resumable from the workflow-start menu.

## A. Close the Session

Read the roadmap state:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap state
```

#### If `active_session` is `null` (browse only — no session was ever opened)

Nothing to close.

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

#### Otherwise

Replace the log's `(none)` Conclusion with the finalisation line ([session-template.md](session-template.md) names the forms), then close — one transaction: marker cleared, log indexed into the knowledge base, everything committed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap session close -m "roadmap: close session {session_number}"
```

If the response carries `warnings`, fetch the advisory and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render roadmap-session-receipt --warn
```

> *Output the next fenced block as markdown (not a code block):*

```
> Session closed and saved — everything stays on the map.
```

→ Return to **[the skill](../SKILL.md)** for **Step 3**.
