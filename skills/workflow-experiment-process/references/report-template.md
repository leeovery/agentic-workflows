# Experiment Report Template

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

Use this template when authoring an experiment's `report.md`. The report grows during the run — results and deviations land as they happen; reading and conclusion follow when measurement is complete.

## Template

```markdown
# {Id}: {Title} — Report

## Results

{What was measured, as measured. Every number traces to a file in this
experiment's directory (curated extracts under data/) or a named
source. A measure conceived after seeing data is labelled
**exploratory**.}

## Deviations

{The run as it went, logged in the moment — harness failures,
environment surprises, dropped samples. Empty is a fine entry: "none".}

## Reading

{What the results mean — interpretation, kept separate from the
measurement above.}

## Conclusion

{The pre-registered decision rule executed against the results: which
branch fired and what it triggers. The verdict recorded on the register
is this section's one-line form. A parent's conclusion synthesises its
sub-experiments' verdicts.}

## Reproduce

{How to re-run: commands, entry points, where the data lands.}
```

## Notes

- **Corrections are append-only.** A flaw found after writing gets a dated entry in a `## Corrections` section appended at the end — nothing above it is rewritten, and old data is never re-scored under new rules; the fixed design is the next experiment's.
- Where the output is scoreable, the mechanical score lands in Results and the close read of the actual output lands in Reading — both, always; the score summarises, the read sees.
- Experiment status and the verdict line are tracked in the work unit manifest, not in the document.

→ Return to caller.
