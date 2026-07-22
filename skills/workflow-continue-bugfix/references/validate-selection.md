# Validate Selection

*Reference for **[workflow-continue-bugfix](../SKILL.md)***

---

Validate the selected work unit against the discovery output.

#### If `work_unit` not found in the `=== BUGFIXES (N) ===` section

The `view` snapshot for an unknown name carries the terminal display. Emit its `DISPLAY: not found` section verbatim per its marker.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

The selection is valid. Phase state for this work unit comes from the `view` snapshot at Step 5.

→ Return to caller.
