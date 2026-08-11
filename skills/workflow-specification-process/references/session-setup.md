# Session Setup

*Reference for **[workflow-specification-process](../SKILL.md)***

---

## Reset Gate Modes

Reset `finding_gate_mode` and `construction_gate_mode` to `gated` in one batched write:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} finding_gate_mode=gated construction_gate_mode=gated
```

## Register Consult References

Read the tracked set once:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} consult_references
```

Compare against the handoff's `Consult references` block. If any named reference is untracked, write one `set` op per missing reference to `.workflows/.cache/{work_unit}/specification/{topic}/consult-refs-ops.json` with the Write tool, then register them in one call (skip the call when nothing is missing):

```json
[{"op": "set", "path": "{work_unit}.specification.{topic}", "fields": {"consult_references.{ref}.status": "pending"}}]
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest apply {work_unit} --file .workflows/.cache/{work_unit}/specification/{topic}/consult-refs-ops.json
```

**Never overwrite an existing status** — only untracked references enter the payload, so an already-`addressed` reference stays `addressed`. This runs every session: references newly declared on a continue are picked up while prior progress is preserved.

## Hold the Grouping Analysis's Tensions

Read any `**Tension**` lines for this specification's grouping from `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` (skip silently when the file or the lines are absent — single-source specs and bugfixes have none). Hold them in session: construction raises each per its Resolve Source Incoherence discipline when the topic that touches it arrives.

## Reconcile Stale Sources First

Read the sources map (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources`).

#### If any row reads `stale`

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Reconcile Stale Sources`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> A source was re-decided after this spec extracted it. The revision is pulled in now, before construction resumes — each change comes to you as a diff for approval.
```

For each stale row, load **[reconcile-stale-sources.md](reconcile-stale-sources.md)** and follow its instructions as written; after each, re-read the sources map and continue until no workable `stale` row remains. A row whose source discussion is still `in-progress` defers there and stays `stale` — construction can proceed on other topics, but conclusion will wait for it.

→ Return to caller.

#### Otherwise

→ Return to caller.
