# Discovery Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route a concluded discovery session. An epic returns to its menu (the user picks the next move from the map); every other work type hands off to its first phase. Both use a plan-mode handoff so the next step starts in a clean context, free of discovery's shaping instructions. There is no `next_phase` computation — epic's destination is the menu, and single-phase types arrive with `next_phase` already supplied by the discovery endpoint.

## A. Branch by Work Type

#### If work type is `epic`

→ Proceed to **B. Return to the Epic Menu**.

#### Otherwise

→ Proceed to **C. Hand Off to the First Phase**.

## B. Return to the Epic Menu

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Epic: {work_unit}

The discovery session has concluded. Return to the epic menu to pick the next move from the discovery map.

## Next Step

Invoke `/continue-epic {work_unit}`

The epic menu will render the discovery map and let you start, continue, or refine any topic.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.

## C. Hand Off to the First Phase

The discovery endpoint supplied `next_phase` (`research` / `discussion` / `investigation` / `scoping`). Call the `EnterPlanMode` tool, then write the following content to the plan file:

```
# Start {next_phase:(titlecase)}: {work_unit}

Discovery has shaped this {work_type}. Begin its first phase in a clean context.

## Next Step

Invoke `/workflow-{next_phase}-entry {work_type} {work_unit}`

The entry skill reads the durable carrier — the discovery session log and the manifest `description` — as its seed; it does not depend on this session's context.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.
