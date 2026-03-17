# Validate Selection

*Reference for **[continue-bugfix](../SKILL.md)***

---

Validate the selected work unit against the discovery output and store its data.

#### If `work_unit` not found in bugfixes array

> *Output the next fenced block as a code block:*

```
Continue Bugfix

No active bugfix named "{work_unit}" found.

Run /continue-bugfix to see available bugfixes, or /start-bugfix to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Store the matched bugfix's data (name, next_phase, phase_label, completed_phases).

→ Return to caller.
