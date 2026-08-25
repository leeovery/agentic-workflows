# Sequence Build Order

*Shared reference. Loaded by `workflow-continue-epic` and `workflow-bridge`.*

---

Assign the build order across an epic's live specification topics — Claude's read of which topic to specify, plan, and implement first. The order is soft: it sorts and selects recommendations within a phase, but never blocks. It is re-derived wholesale — a full renumber of every live topic — whenever the live numbering is broken (a topic without an order, a duplicate, or a hole left by a cancel), a completed specification flags the order stale, or the user asks for a re-derive.

Manifest-driven, so it runs identically from every caller.

## Parameters

The caller provides this via context before loading:

- `work_unit` — the epic's work unit name. Always present.

## A. Gate on Work Type

A build order only exists for epics.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

#### If the work type is `epic`

→ Proceed to **B. Gather Live Topics**.

#### Otherwise

→ Return to caller.

## B. Gather Live Topics

Read the specification subtree — every topic's status and sources arrive in one call:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification
```

The live set is every topic whose status is not `cancelled`, `superseded`, or `promoted` — completed topics stay and keep a number. For grouped topics, the `sources` entries name the member discussions; read a discussion document or a completed specification where the grouping alone leaves a topic's ground unclear.

Ignore the discovery map's order entirely — it ranks what to *explore* first, assigned from one-line sketches before any discussion concluded; the build order ranks what must physically exist first, read from the concluded record.

→ Proceed to **C. Assign and Write Order**.

## C. Assign and Write Order

Analyse the live set holistically and decide the build order — which topic to build first, which next, and so on. Weigh what must physically exist before what: declared dependencies in completed specifications, a topic whose deliverable other topics assume in their acceptance criteria, foundational scaffolding over features that sit on it. This is a judgement call across the whole set, not a per-topic rule.

Assign contiguous integers `1..N` over the live topics — `1` is the suggested first build. Full renumber every time: cover every live topic, close any gaps, ignore any prior `order` values. Record the whole assignment in one call — it sets each topic's `order`, clears the stale flag, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs build-order sequence {work_unit} {topic}={N} {topic}={N}
```

The engine refuses a partial assignment (naming the missing topics) and a non-contiguous numbering — re-issue with the whole live set.

→ Return to caller.
