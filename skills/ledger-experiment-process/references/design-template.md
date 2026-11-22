# Design Template

*Reference for **[ledger-experiment-process](../SKILL.md)***

---

The shape of an experiment's `design.md`. Every section is answered before anything is measured; only the length of the answers scales.

```markdown
# {Id}: {Title}

## Question

{One line, and the decision this answer feeds.}

## Prediction

{What we expect and why, with expected values where possible. One primary
question; any secondary measure is labelled secondary.}

## Decision rule

{"If X, we do A; if Y, B", concrete enough that a third party could
apply it to the results without judgment.}

## Setup

{Method and the shape the run takes. Instruments and their versions.
Sample, cases or layouts. Environment.}
```

Where the design's shape warrants them — stochastic outputs, destructive operations, several arms compared — add these:

```markdown
## Controls and biases

{The comparison arm and how it runs beside the treated one. Known biases
and what is done about them. For stochastic outputs, repeats and how
variance is handled; for a staged run, the smoke pass before the full one.}

## What this does not measure

{The questions a reader might assume this answers, and it doesn't.}
```

A measured setup fact keeps its command alone in its code span, so it runs again by copy: `` `rg -l 'pattern' | wc -l` → 14 ``.
