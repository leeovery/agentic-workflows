# Reconcile Advisory

*Shared reference for the phase entry skills.*

---

Caller passes `work_type`, `work_unit`, `topic`, and `downstream_phase` — the entered phase, whose item may carry the flag. The flag's value names what moved upstream and keys the branch below. Every populated branch surfaces a non-blocking advisory (never a STOP gate) and clears the flag.

Read the reconcile flag on the item:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

`get` returns empty on an absent field.

#### If output is empty (no reconcile pending)

The common case. No output.

→ Return to caller.

#### If output is `research` (upstream research reopened)

This topic's research reopened after the downstream work concluded — its decisions may rest on ground the research re-examined. Surface the advisory, read the topic's research file fresh into context, and clear the flag.

> *Output the next fenced block as a code block:*

```
  ⚑ This topic's research was reopened after this work
    concluded. Re-read it — decisions here may need revisiting
    against what it found. Nothing has been overwritten.
```

Read `.workflows/{work_unit}/research/{topic}.md` in full, then clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### If output is `investigation` (upstream investigation reopened)

The investigation reopened after this specification concluded — the root cause may have shifted beneath it. Surface the advisory, read the investigation file fresh into context, and clear the flag.

> *Output the next fenced block as a code block:*

```
  ⚑ This topic's investigation was reopened after the
    specification concluded. Re-read it — the root cause may
    have shifted. Nothing has been overwritten.
```

Read `.workflows/{work_unit}/investigation/{topic}.md` in full, then clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

The reopen also flipped the spec's source row to `stale`; the specification session reconciles it (**[../../workflow-specification-process/references/reconcile-stale-sources.md](../../workflow-specification-process/references/reconcile-stale-sources.md)**, with `{source phase}` = `investigation`) at its setup or conclusion — sign-off waits on it.

→ Return to caller.

#### If output is `discussion` (a source discussion re-decided)

A discussion this specification extracted was re-decided after extraction. The spec's `sources` rows record which — every row whose status is `stale`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources
```

Surface the advisory. The `stale` rows themselves stay — the session reconciles them per **[reconcile-stale-sources.md](../../workflow-specification-process/references/reconcile-stale-sources.md)**, and only re-incorporation clears a row.

> *Output the next fenced block as a code block:*

```
  ⚑ A source discussion was re-decided after this specification
    extracted it. The stale source rows mark which — re-read
    them and reconcile the extracted content against the new
    decisions. Nothing has been overwritten.
```

Read each stale source's discussion file (`.workflows/{work_unit}/discussion/{source-name}.md`) in full, then clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### If output is `specification` (the spec revised beneath the plan)

The specification was revised after this plan completed. Surface the advisory and clear the flag — the planning process's own spec-change detection runs at resume and walks the diff.

> *Output the next fenced block as a code block:*

```
  ⚑ The specification was revised after this plan completed.
    Spec-change detection will walk the diff as this session
    resumes. Nothing has been overwritten.
```

Clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### If output is `scoping` (the quick-fix scope revised)

Scoping was revisited after this implementation completed — the spec and plan it registered may have changed. Surface the advisory, re-read the plan before continuing, and clear the flag.

> *Output the next fenced block as a code block:*

```
  ⚑ Scoping was revisited after this implementation completed.
    Re-check the plan before continuing — the scope may have
    moved. Nothing has been overwritten.
```

Read `.workflows/{work_unit}/planning/{topic}/planning.md` in full, then clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### If output is `planning` (the plan revised beneath the implementation)

The plan was revised after this implementation completed. Surface the advisory, re-read the plan before continuing, and clear the flag.

> *Output the next fenced block as a code block:*

```
  ⚑ The plan was revised after this implementation completed.
    Re-read it — what was built may no longer match what is
    planned. Nothing has been overwritten.
```

Read `.workflows/{work_unit}/planning/{topic}/planning.md` in full, then clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### If output is `implementation` (the implementation changed beneath the review)

The implementation reopened and changed after this review concluded. Surface the advisory and clear the flag — the review re-runs against the changed scope.

> *Output the next fenced block as a code block:*

```
  ⚑ The implementation changed after this review concluded.
    Review the changed scope — the prior verdict predates it.
    Nothing has been overwritten.
```

Clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### If output is `roadmap` (the product record deepened beneath this work)

A roadmap session materially deepened this item's ground after the work started. The joined roadmap item's `sources` name the record — read the roadmap state, find the item whose row's `work_unit` and `topic` name this work, and read its most recent source log fresh into context. Then clear the flag.

> *Output the next fenced block as a code block:*

```
  ⚑ The product-level record deepened this ground after the
    work started. Re-read the roadmap session it points at —
    decisions here may need revisiting. Nothing has been
    overwritten.
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap state
```

Read the newest log the item's `sources` names (paths are relative to `.workflows/`), then clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### Otherwise (brief reconcile flagged)

A discovery brief was written or regenerated after this work started. Surface the advisory, re-read the regenerated brief into context, and clear the flag.

> *Output the next fenced block as a code block:*

```
  ⚑ Discovery context changed since this work started.
    Reconciling against the latest discovery brief —
    review and update as needed. Nothing has been overwritten.
```

→ Load **[read-brief-context.md](read-brief-context.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`.

Clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.
