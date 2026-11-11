# Pivot to Epic

*Shared reference. Loaded by `leeway`'s managing of a unit and by `leeway-discussion-process` (a point needing decisions of its own) to make a feature an epic.*

---

The feature becomes an epic, its one topic, under the feature's own name, the first on the epic's map. Draft what the topic's map row says of it, from its record and its log, reading whichever is not already in context: its `{summary}`, one line in the product's terms, and its `{description}`. The record is `ledger record {work_unit} {work_unit}`, the log `.leeway/{work_unit}/topics/{work_unit}/log.md`. Then pivot:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs workunit pivot {work_unit} --summary "{summary}" --description "{description}"
```

A refusal names what holds the feature: say it in a line. Otherwise fetch its receipt and emit its sections verbatim per their markers, `--warn` where the response's `warnings` is non-empty:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb pivot [--warn]
```
