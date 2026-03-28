# Validate Selection

*Reference for **[continue-quickfix](../SKILL.md)***

---

Validate the selected work unit against the discovery output and store its data.

#### If `work_unit` not found in quick_fixes array

> *Output the next fenced block as a code block:*

```
Continue Quick-Fix

No active quick-fix named "{work_unit}" found.

Run /continue-quickfix to see available quick-fixes, or /start-quickfix to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Store the matched quick-fix's data (name, next_phase, phase_label, completed_phases).

→ Return to caller.
