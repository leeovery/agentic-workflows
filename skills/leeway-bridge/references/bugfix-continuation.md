# Bugfix Continuation

*Reference for **[leeway-bridge](../SKILL.md)***

---

Route a bugfix to its next pipeline phase, with an option to revisit its investigation.

Bugfix pipeline: Investigation → Specification → Implementation → Review

## A. Offer Next Phase

Set `route` = `next_route`.

The engine derives the offer from manifest state — the revisit row where the investigation is completed and the spec not yet written. An empty response means continuing is the only way forward:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render next-phase-gate {work_unit} --prev {completed_phase} --next {next_phase}
```

#### If the response is empty

→ Proceed to **C. Hand Off**.

#### If the response carried `MENU: next phase gate`

Emit the section verbatim per its marker.

**STOP.** Wait for user response.

**If user chose `y/yes`:**

→ Proceed to **C. Hand Off**.

**If user chose `r/revisit`:**

→ Proceed to **B. Select Phase**.

## B. Select Phase

Fetch and emit the `MENU: revisit phases` section verbatim per its marker (its numbering follows `revisitable_phases` order):

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render revisit-phases {work_unit}
```

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. Offer Next Phase**.

#### If user chose a phase

Set `route` = the number's entry in `revisit_routes`.

→ Proceed to **C. Hand Off**.

## C. Hand Off

→ Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `{route}`.
