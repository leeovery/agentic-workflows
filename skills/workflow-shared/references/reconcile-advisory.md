# Reconcile Advisory

*Shared reference for the research and discussion entry skills.*

---

Caller passes `work_type`, `work_unit`, `topic`, and `downstream_phase` = `research` | `discussion` — the phase whose downstream item may carry the flag.

Read the reconcile flag on the downstream item:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

`get` returns empty on an absent field.

#### If output is empty (no reconcile pending)

The common case. No output.

→ Return to caller.

#### If output is `research` (upstream research reopened)

A triage landing reopened this topic's research after the discussion concluded — its decisions may rest on ground the research is re-examining. Surface a non-blocking advisory (never a STOP gate), read the topic's research file fresh into context, and clear the flag.

> *Output the next fenced block as a code block:*

```
  ⚑ This topic's research was reopened after the discussion
    concluded. Re-read it — decisions here may need revisiting
    against what it found. Nothing has been overwritten.
```

Read `.workflows/{work_unit}/research/{topic}.md` in full, then clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### Otherwise (brief reconcile flagged)

A discovery brief was written or regenerated after this work started. Surface a non-blocking advisory (never a STOP gate), re-read the regenerated brief into context, and clear the flag.

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
