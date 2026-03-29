# Validate Selection

*Reference for **[continue-feature](../SKILL.md)***

---

Validate the selected work unit against the discovery output and store its data.

#### If `work_unit` not found in features array

> *Output the next fenced block as a code block:*

```
No active feature named "{work_unit}" found.

Run /continue-feature to see available features, or /start-feature to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Store the matched feature's data (name, next_phase, phase_label, completed_phases).

→ Return to caller.
