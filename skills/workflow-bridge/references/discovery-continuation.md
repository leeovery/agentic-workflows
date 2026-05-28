# Discovery Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route an discovery session conclusion back to `/continue-epic`. Discovery always returns to the epic menu after concluding — the user picks the next move (start research, start discussion, refine the map, etc.) from the discovery map. There is no `next_phase` computation; the destination is deterministic.

## A. Enter Plan Mode

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
