# Experiment Design Template

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

Use this template when authoring an experiment's `design.md`. The skeleton is always answered before anything is measured; only the length of the answers scales.

## Template

```markdown
# {Id}: {Title}

## Question

{One line. Plus the decision this answer feeds.}

## Prediction

{What we expect and why — expected values where possible. One primary
question; any secondary measure is labelled secondary.}

## Decision rule

{"If X, we do A; if Y, B" — concrete enough that a third party could
execute it against the results without judgment.}

## Setup

{Method. Instruments and their versions. Sample/cases/layouts.
Environment.}
```

## Conditional Sections

Add these when the design's shape warrants them — real money declared as a measure, stochastic outputs, destructive operations, or multi-arm comparisons. Depth scales; the process doesn't fork.

```markdown
## Controls and biases

{The comparison arm and how it runs concurrently. Known biases and
what's done about them. For stochastic outputs: repeats and variance
handling. For staged runs: the smoke pass before the full pass.}

## What this does not measure

{The boundary — questions a reader might assume this answers but it
doesn't.}
```

## Notes

- **Frozen at the confirm gate.** After approval the design changes only by the amendment protocol — a dated `## Amendments` section appended when one lands, never a rewrite of what's above it.
- Instruments named here freeze with the design — name the exact script, tool, and version that will do the measuring.
- Experiment status is tracked in the work unit manifest, not in the document.
- **Measured claims**: a load-bearing setup claim (what an instrument does, what the sample contains) is measured when written, the command recorded with its result, the command alone in its span so it re-runs by copy (`` `rg -l 'pattern' | wc -l` → 14 ``).

→ Return to caller.
