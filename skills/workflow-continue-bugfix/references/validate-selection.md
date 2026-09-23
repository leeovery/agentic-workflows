# Validate Selection

*Reference for **[workflow-continue-bugfix](../SKILL.md)***

---

Validate the selected work unit against the discovery output.

#### If `work_unit` not found in the `=== BUGFIXES (N) ===` section

Fetch the terminal display — the `view` snapshot for an unknown name carries it:

```bash
node .claude/skills/workflow-continue-bugfix/scripts/gateway.cjs view {work_unit}
```

Emit its `DISPLAY: not found` section verbatim per its marker.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

The selection is valid. Phase state for this work unit comes from the `view` snapshot at Step 5.

→ Return to caller.
