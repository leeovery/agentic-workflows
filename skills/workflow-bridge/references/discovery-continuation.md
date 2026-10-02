# Discovery Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route a concluded discovery session. The destination is **given, not derived** — discovery is the first phase, so the next phase isn't in pipeline state yet.

#### If work type is `epic`

The epic returns to its menu, where the person picks the next move from the map.

→ Load **[handing-off.md](../../workflow-shared/references/handing-off.md)** with skill = `workflow-continue-epic`, args = `{work_unit}`.

#### Otherwise

The work goes to the first phase the discovery endpoint supplied as `next_phase` — `research`, `discussion`, `investigation` or `scoping`.

→ Load **[handing-off.md](../../workflow-shared/references/handing-off.md)** with skill = `workflow-{next_phase}-entry`, args = `{work_type} {work_unit}`.
