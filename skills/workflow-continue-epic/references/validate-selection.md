# Validate Selection

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

Validate the selected work unit against the discovery index, then load its state surface. Read the index from the `select` response when the user picked at Step 3, from the Step 1 dump when the work unit arrived as an argument.

#### If `work_unit` not found in that index's `=== EPICS (N) ===` section

Fetch the terminal display — the `view` snapshot for an unknown name carries it:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs view {work_unit}
```

Emit its `DISPLAY: not found` section verbatim per its marker.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Run the scoped discovery for the selected epic and hold its output as **the most recent discovery output** — Steps 5–8 read `discovery_map`, `analysis_caches`, `needs_sequencing`, and `build_order_needs_sequencing` from it:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs {work_unit}
```

→ Return to caller.
