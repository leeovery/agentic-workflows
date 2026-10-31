# Discovery Continuation

*Reference for **[leeway-bridge](../SKILL.md)***

---

Route a concluded discovery session. The destination is **given, not derived** — discovery is the first phase, so the next phase isn't in pipeline state yet.

#### If work type is `epic`

The epic returns to its menu, where the person picks the next move from the map.

→ Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `/leeway-continue-epic {work_unit}`.

#### Otherwise

The work goes to the first phase the discovery endpoint supplied as `next_phase` — `discussion`, `investigation` or `scoping`.

→ Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `/leeway-{next_phase}-process {work_type} {work_unit}`.
