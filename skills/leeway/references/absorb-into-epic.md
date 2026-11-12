# Absorb into an Epic

*Reference for **[manage-work-unit.md](manage-work-unit.md)***

---

The feature becomes a topic of the epic, under the feature's own name, `{topic}` = `{work_unit}`. Draft what the topic's map row says of it, from its record, `ledger record {work_unit} {work_unit}`, and its log, `.leeway/{work_unit}/topics/{work_unit}/log.md`: its `{summary}`, one line in the product's terms, and, where they say more than the summary does, its `{description}`. Then fetch the confirm, `--description` only where there is one, and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render absorb-confirm-gate {work_unit} --into {epic} --topic {topic} --summary "{summary}" [--description "{description}"]
```

A refusal ending `— pick a different name` means the epic holds the name already: derive another kebab-case name from the feature's, set `{topic}` to it, and fetch the confirm again. Any other refusal: say it in a line.

The answer goes to `gate`; follow its `next`. Once the absorb has run, fetch its receipt and emit its sections verbatim per their markers. `--moved` lists whichever of `seeds`, `assets` and `spikes` the response reported non-empty, comma-joined; `--experiments` is the count of top-level ids, those with no dot, in its `experiment.experiments` where a series moved; `--renamed` is its `renamed_assets` and `renamed_spikes` as comma-joined `{from}:{to}` pairs; and `--warn` rides where its `warnings` is non-empty. Each is left out where it has nothing:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render absorb-receipt {epic} --topic {topic} [--moved {moved}] [--experiments {n}] [--renamed {renamed}] [--warn]
```
