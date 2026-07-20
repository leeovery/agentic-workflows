# Validate Selection

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

Validate the selected work unit against the discovery output, then load its state surface.

#### If `work_unit` not found in the `=== EPICS (N) ===` section

> *Output the next fenced block as a code block:*

```
No active epic named "{work_unit}" found.

Run /workflow-start to see available epics or begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Run the scoped discovery for the selected epic and hold its output as **the most recent discovery output** — Steps 5–7 read `discovery_map`, `analysis_caches`, and `needs_sequencing` from it:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs {work_unit}
```

→ Return to caller.
