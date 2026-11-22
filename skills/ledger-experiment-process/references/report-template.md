# Report Template

*Reference for **[ledger-experiment-process](../SKILL.md)***

---

The shape of an experiment's `report.md`. It grows during the run: results and deviations land as they happen, and the reading and the conclusion follow once measurement is complete.

```markdown
# {Id}: {Title} — Report

## Results

{What was measured, as measured. Every number traces to a file in this
experiment's folder, curated extracts under data/, or a named source. A
measure thought of after seeing the data is labelled **exploratory**.
Where the output is scoreable, the mechanical score.}

## Deviations

{The run as it went, logged in the moment: harness failures,
environment surprises, dropped samples. "None" is a fine entry.}

## Reading

{What the results mean, kept apart from the measurement above, the close
read of the actual output among it.}

## Conclusion

{The pre-registered decision rule applied to the results: which branch
fired and what it triggers. The verdict is this section in one line. A
parent's conclusion brings its splits' verdicts together.}

## Reproduce

{How to run it again: commands, entry points, where the data lands.}
```

A flaw found after the report is written goes in a `## Corrections` section appended at its end, each entry dated; nothing above it is rewritten.
