# Absorb into an Epic

*Reference for **[manage-work-unit.md](manage-work-unit.md)***

---

The feature becomes a topic of the epic, under the feature's own name, `{topic}` = `{work_unit}`. Draft what the topic's map row says of it, from its record, `ledger record {work_unit} {work_unit}`, and its log, `.ledger/{work_unit}/topics/{work_unit}/log.md`: its `{summary}`, one line in the product's terms, and, where they say more than the summary does, its `{description}`. Then fetch the confirm, `--description` only where there is one:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render absorb-confirm-gate {work_unit} --into {epic} --topic {topic} --summary "{summary}" [--description "{description}"]
```

A refusal asking for a different name: set `{topic}` to another, drawn from the feature's, and fetch the confirm again. Any other refusal: say it in a line.
