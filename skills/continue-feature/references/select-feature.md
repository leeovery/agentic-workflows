# Select Feature

*Reference for **[continue-feature](../SKILL.md)***

---

Display active features and let the user select one.

> *Output the next fenced block as a code block:*

```
Continue Feature

{count} feature(s) in progress:

@foreach(feature in features)
  {N}. {feature.name:(titlecase)}
     └─ {feature.phase_label:(titlecase)}

@endforeach
```

Build from the discovery output's `features` array. Each feature shows `name` (titlecased) and `phase_label` (titlecased). Blank line between each numbered item.

After the tree display, if `concluded_count > 0` or `cancelled_count > 0`, add a summary line:

> *Output the next fenced block as a code block:*

```
{concluded_count} concluded, {cancelled_count} cancelled.
```

Only show this block if either count is non-zero.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which feature would you like to continue?

1. Continue "{feature.name:(titlecase)}" — {feature.phase_label}
2. ...

{N+1}. View concluded & cancelled features
- **`m`/`manage`** — Manage a feature's lifecycle

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual features and `phase_label` values from discovery. Only show "View concluded & cancelled" if `concluded_count > 0` or `cancelled_count > 0`. No auto-select, even with one item.

**STOP.** Wait for user response.

**If user chose a feature number:**

Store the selected feature's name as `work_unit`.

→ Return to **[the skill](../SKILL.md)**.

**If user chose "View concluded & cancelled":**

→ Load **[../../workflow-start/references/view-concluded.md](../../workflow-start/references/view-concluded.md)** with work_type filter = `feature`. On return, re-run discovery and redisplay from the top of this reference.

**If user chose `m`/`manage`:**

→ Load **[../../workflow-start/references/manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)**. On return, re-run discovery and redisplay from the top of this reference.
