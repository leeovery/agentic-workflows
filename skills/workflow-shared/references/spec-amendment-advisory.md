# Spec Amendment Advisory

*Shared reference for the planning entry skill.*

---

Caller passes `work_unit` and `topic`.

Read the amendment flag on the planning item:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} spec_reconcile_needed
```

`get` returns empty on an absent field.

#### If output is empty (no amendment pending)

The common case. No output.

→ Return to caller.

#### If output is non-empty (specification amended)

A corrigendum corrected the specification after this plan was built from it. Surface a non-blocking advisory (never a STOP gate), re-read the corrected specification into context, and clear the flag.

> *Output the next fenced block as a code block:*

```
  ⚑ The specification was corrected after this plan was built.
    Reconciling the plan against the corrected text — review and
    update the affected tasks. Nothing has been overwritten.
```

Resolve the specification and read it in full. The corrigendum blocks beneath its H1 name what changed and what it replaced:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest resolve {work_unit}.specification.{topic}
```

Clear the flag:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.planning.{topic} spec_reconcile_needed
```

→ Return to caller.
