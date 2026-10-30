# Discovery Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route a concluded discovery session. The destination is **given, not derived** — discovery is the first phase, so the next phase isn't in pipeline state yet.

#### If work type is `epic`

The epic returns to its menu, where the person picks the next move from the map.

→ Load **[handing-off.md](../../workflow-shared/references/handing-off.md)** with route = `/workflow-continue-epic {work_unit}`.

#### Otherwise

The work goes to the first phase the discovery endpoint supplied as `next_phase` — `research`, `discussion`, `investigation` or `scoping`.

→ Load **[handing-off.md](../../workflow-shared/references/handing-off.md)** with route = `/workflow-{next_phase}-process {work_type} {work_unit}`.
