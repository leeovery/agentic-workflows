# Sequence Discovery Map

*Shared reference. Loaded by `workflow-continue-epic` and `workflow-bridge`.*

---

Assign a suggested execution order across the live topics of an epic's discovery map — Claude's read of which topic to tackle first. The order is soft: it sorts the map rows and selects which item is `(recommended)`, but never gates. It is re-derived wholesale — a full renumber of all live topics — whenever a new one lands without an order.

Manifest-driven, so it runs identically from either caller. The caller fires it only when its discovery output reports `needs_sequencing: true`, and re-runs discovery afterward so the render picks up the new order.

## Parameters

The caller provides this via context before loading:

- `work_unit` — the epic's work unit name. Always present.

## A. Gate on Work Type

A discovery map only exists for epics.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} work_type
```

#### If the work type is `epic`

→ Proceed to **B. Gather Live Topics**.

#### Otherwise

→ Return to caller.

## B. Gather Live Topics

Take the live topic names from the caller's most recent discovery output — every `discovery_map` row whose tier is neither `⊘` (cancelled) nor `⊙` (handled). Handled topics are non-actionable — a research umbrella that fanned out — so they get no execution order, the same as cancelled.

For richer context, read each live topic's `summary` and `description` from the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{topic} summary
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{topic} description
```

→ Proceed to **C. Assign and Write Order**.

## C. Assign and Write Order

Analyse the live set holistically and decide a suggested execution order — which topic to start with, which to do next, and so on. Weigh what is foundational versus dependent, what de-risks the rest of the work, and what the user signalled as a starting point. This is a judgement call across the whole set, not a per-topic rule.

Assign contiguous integers `1..N` over the live topics — `1` is the suggested first topic. Full renumber every time: close any gaps, ignore any prior `order` values. Write each one:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{topic} order {N}
```

→ Proceed to **D. Commit**.

## D. Commit

```bash
git add -- .workflows/{work_unit}/
git commit -m "discovery({work_unit}): sequence topic map"
```

→ Return to caller.
