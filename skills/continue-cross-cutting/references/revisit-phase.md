# Backwards Navigation

*Reference for **[continue-cross-cutting](../SKILL.md)***

---

Offer the user a choice between proceeding to the next phase or revisiting an earlier completed phase.

## A. Check for Earlier Phases

Using the selected cross-cutting concern's `completed_phases` list, determine if there are any completed phases that come before `next_phase` in the pipeline.

#### If no earlier completed phases exist

Skip this step — route directly to the next phase.

→ Return to caller.

#### If earlier completed phases exist

→ Proceed to **B. Proceed or Revisit**.

## B. Proceed or Revisit

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continuing "{cross_cutting.name:(titlecase)}" — {cross_cutting.phase_label}.

- **`y`/`yes`** — Proceed to {next_phase}
- **`r`/`revisit`** — Revisit an earlier phase

· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `y`/`yes`

→ Return to caller.

#### If user chose `r`/`revisit`

→ Proceed to **C. Select Phase**.

## C. Select Phase

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which phase would you like to revisit?

1. {phase:(titlecase)} — completed
2. ...
{N}. Back

Select an option (enter number):
· · · · · · · · · · · ·
```

List only phases from `completed_phases`.

**STOP.** Wait for user response.

#### If user chose Back

→ Return to **B. Proceed or Revisit**.

#### If user chose a phase

Store the selected phase as the target phase (overriding `next_phase`).

→ Return to caller.
