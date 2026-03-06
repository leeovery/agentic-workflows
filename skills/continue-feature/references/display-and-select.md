# Display and Select Feature

*Reference for **[continue-feature](../SKILL.md)***

---

Display active features and let the user select one.

## Display

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

## Menu

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which feature would you like to continue?

1. Continue "{feature.name:(titlecase)}" — {feature.phase_label}
2. ...

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual features and `phase_label` values from discovery. No auto-select, even with one item.

**STOP.** Wait for user response.

## Process Selection

Store the selected feature's data (name, next_phase, phase_label, concluded_phases) for use in subsequent steps.

→ Return to **[the skill](../SKILL.md)**.
