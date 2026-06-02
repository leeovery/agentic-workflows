# Validate Selection

*Reference for **[workflow-continue-cross-cutting](../SKILL.md)***

---

Validate the selected work unit against the discovery output and store its data.

#### If `work_unit` not found in cross_cutting array

> *Output the next fenced block as a code block:*

```
No active cross-cutting concern named "{work_unit}" found.

Run /workflow-start to see available concerns or begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Store the matched cross-cutting concern's data (name, next_phase, phase_label, completed_phases).

→ Return to caller.
