# Validate Selection

*Reference for **[workflow-continue-cross-cutting](../SKILL.md)***

---

Validate the selected work unit against the discovery output.

#### If `work_unit` not found in the `=== CROSS-CUTTING ===` section

> *Output the next fenced block as a code block:*

```
No active cross-cutting concern named "{work_unit}" found.

Run /workflow-start to see available concerns or begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

The selection is valid. Phase state for this work unit comes from the `view` snapshot at Step 5.

→ Return to caller.
