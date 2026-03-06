# Backwards Navigation

*Reference for **[continue-feature](../SKILL.md)***

---

Offer the user a choice between proceeding to the next phase or revisiting an earlier concluded phase.

## Check for Earlier Phases

Using the selected feature's `concluded_phases` list, determine if there are any concluded phases that come before `next_phase` in the pipeline.

#### If no earlier concluded phases exist

Skip this step — route directly to the next phase.

→ Return to **[the skill](../SKILL.md)**.

#### If earlier concluded phases exist

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continuing "{feature.name:(titlecase)}" — {feature.phase_label}.

- **`y`/`yes`** — Proceed to {next_phase}
- **`r`/`revisit`** — Revisit an earlier phase

· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `y`/`yes`

→ Return to **[the skill](../SKILL.md)**.

#### If user chose `r`/`revisit`

Show the concluded phases:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which phase would you like to revisit?

1. {phase:(titlecase)} — concluded
2. ...
{N}. Back

Select an option (enter number):
· · · · · · · · · · · ·
```

List only phases from `concluded_phases`. "Back" returns to the proceed/revisit prompt above.

**STOP.** Wait for user response.

#### If user chose Back

Return to the proceed/revisit prompt above (re-display it).

#### If user chose a phase

Store the selected phase as the target phase (overriding `next_phase`).

→ Return to **[the skill](../SKILL.md)**.
