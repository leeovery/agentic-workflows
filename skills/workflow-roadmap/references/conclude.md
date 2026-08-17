# Conclude

*Reference for **[workflow-roadmap](../SKILL.md)***

---

Close the session, then offer the pull. Stopping here is first-class — a harvested roadmap with zero work units is a complete outcome, banked and resumable from the workflow-start menu.

## A. Close the Session

Read the roadmap state:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap state
```

#### If `active_session` is `null` (browse only — no session was ever opened)

Nothing to close.

→ Proceed to **B. Stop or Pull**.

#### Otherwise

Replace the log's `(none)` Conclusion with the finalisation line ([session-template.md](session-template.md) names the forms), then close — one transaction: marker cleared, log indexed into the knowledge base, everything committed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap session close -m "roadmap: close session {session_number}"
```

If the response carries `warnings`, fetch the advisory and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render roadmap-session-receipt --warn
```

→ Proceed to **B. Stop or Pull**.

## B. Stop or Pull

Branch on the state read in **A**:

#### If `totals.waiting` is `0`

Nothing is pullable.

> *Output the next fenced block as markdown (not a code block):*

```
> Session closed and saved. The roadmap is on the workflow-start menu whenever you want back in.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Fetch the gate and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render roadmap-conclude-gate
```

**STOP.** Wait for user response.

#### If `pull`

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

#### If `stop`

> *Output the next fenced block as markdown (not a code block):*

```
> Session closed and saved. Pull a slice any time from the workflow-start menu's roadmap row.
```

**STOP.** Do not proceed — terminal condition.
