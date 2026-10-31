# Pull

*Reference for **[leeway-roadmap](../SKILL.md)***

---

The commitment point. Select waiting items and hand them to discovery as the seeds of new work: discovery reads their record, finds the type, and creates the unit at start this work, joining the items. The pull takes whole items — wanting half an item means the item is two items; split it on the map first (rename the item to one half, `roadmap add` the other), never inline here.

## A. Select the Working Set

Render the pull working set:

```bash
node .claude/skills/leeway-roadmap/scripts/gateway.cjs pull-set
```

The output arrives in demarcated sections: read `=== DATA` to reason from (the `ITEMS` table resolves selection numbers — never display it); emit the DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `back`

→ Return to **[the skill](../SKILL.md)** for **Step 1**.

#### Otherwise

Resolve the selected number(s) through the `ITEMS` table and hold the item names, with each one's `kind`, as the **pulled set**.

→ Proceed to **B. Hand Off to Discovery**.

## B. Hand Off to Discovery

The pulled set's kinds give discovery its pre-seed, a hint it still confirms: `{way_in}` is `start` where any item is an idea — the shape is discovery's to find — else `bugfix` where any is a bug, else `quick-fix`. `{seeds}` is the pulled set, each item as `roadmap:{item}`, comma-joined.

→ Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `/leeway-discovery {way_in} none "{seeds}"`.
