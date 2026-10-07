# Session Setup

*Reference for **[workflow-specification-process](../SKILL.md)***

---

## Reset Gate Modes

Reset `finding_gate_mode` and `construction_gate_mode` to `gated` in one batched write:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} finding_gate_mode=gated construction_gate_mode=gated
```

## Hold the Grouping Analysis's Tensions

Read any `**Tension**` lines for this specification's grouping from `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` (skip silently when the file or the lines are absent — only an epic's grouping analysis writes them). Hold them in session: construction raises each per its Resolve Source Incoherence discipline.

## Hold the Incorporated Specifications

Read the started specifications this one incorporates — each sources one of its discussions, and its completion supersedes each:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic incorporations {work_unit} {topic}
```

Hold the response's `incorporations` in session (an empty list holds nothing): each one's `path`, and the discussions among this specification's sources it `covers`. Construction extracts and adapts each one's content alongside those discussions — the result is one specification, not a merge.

## Reconcile Stale Sources First

Read the sources map (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources`).

#### If any row reads `stale`

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Reconcile Stale Sources`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> A source was re-decided after this spec extracted it. The revision is pulled in now, before the specification work carries on — each change comes to you as a diff for approval.
```

For each stale row, load **[reconcile-stale-sources.md](reconcile-stale-sources.md)** and follow its instructions as written; after each, re-read the sources map and continue until no workable `stale` row remains. A row whose source discussion is still `in-progress` defers there and stays `stale` — construction can proceed on other topics, but conclusion will wait for it.

→ Return to caller.

#### Otherwise

→ Return to caller.
