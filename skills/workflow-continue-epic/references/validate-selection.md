# Validate Selection

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

Validate the selected work unit against the discovery output and store its data.

#### If `work_unit` not found in epics array

> *Output the next fenced block as a code block:*

```
No active epic named "{work_unit}" found.

Run /workflow-start to see available epics or begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Store the matched epic's data (name, active_phases, detail) for use in subsequent steps.

→ Return to caller.
