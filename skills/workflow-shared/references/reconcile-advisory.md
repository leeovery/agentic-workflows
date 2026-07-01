# Reconcile Advisory

*Shared reference for the research and discussion entry skills.*

---

Caller passes `downstream_phase` = `research` | `discussion` — the phase whose downstream item may carry the flag.

Read the reconcile flag on the downstream item:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

`get` returns empty on an absent field.

#### If output is empty (no reconcile pending)

The common case. No output.

→ Return to caller.

#### If output is non-empty (reconcile flagged)

The discovery brief was regenerated after this work started. Surface a non-blocking advisory (never a STOP gate), re-read the regenerated brief into context, and clear the flag.

> *Output the next fenced block as a code block:*

```
  ⚑ Discovery context changed since this work started.
    Reconciling against the regenerated discovery brief —
    review and update as needed. Nothing has been overwritten.
```

→ Load **[read-brief-context.md](read-brief-context.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`.

Clear the flag:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.
