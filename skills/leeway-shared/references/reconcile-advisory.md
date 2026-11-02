# Reconcile Advisory

*Shared reference. Loaded where a phase starts — by the planning, implementation and review skills.*

---

Caller passes `work_type`, `work_unit`, `topic`, and `downstream_phase` — the caller's phase, entered or in session, whose item may carry the flag. The flag's value names what moved upstream and keys the branch below. Every populated branch surfaces a non-blocking advisory (never a STOP gate) and clears the flag.

Read the reconcile flag on the item:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs manifest get {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

`get` returns empty on an absent field.

#### If output is empty (no reconcile pending)

The common case. No output.

→ Return to caller.

#### If output is `specification` (the spec revised beneath the plan)

The specification was revised after this plan completed. Surface the advisory and clear the flag — the planning process's own spec-change detection runs at resume and walks the diff.

> *Output the next fenced block as a text code block (```text fence):*

```text
  ⚑ The specification was revised after this plan completed.
    Spec-change detection will walk the diff as this session
    resumes. Nothing has been overwritten.
```

Clear the flag:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### If output is `scoping` (the quick-fix scope revised)

Scoping was revisited after this implementation completed — the spec and plan it registered may have changed. Surface the advisory, re-read the plan before continuing, and clear the flag.

> *Output the next fenced block as a text code block (```text fence):*

```text
  ⚑ Scoping was revisited after this implementation completed.
    Re-check the plan before continuing — the scope may have
    moved. Nothing has been overwritten.
```

Read `.workflows/{work_unit}/planning/{topic}/planning.md` in full, then clear the flag:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### If output is `planning` (the plan revised beneath the implementation)

The plan was revised after this implementation completed. Surface the advisory, re-read the plan before continuing, and clear the flag.

> *Output the next fenced block as a text code block (```text fence):*

```text
  ⚑ The plan was revised after this implementation completed.
    Re-read it — what was built may no longer match what is
    planned. Nothing has been overwritten.
```

Read `.workflows/{work_unit}/planning/{topic}/planning.md` in full, then clear the flag:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.

#### If output is `implementation` (the implementation changed beneath the review)

The implementation reopened and changed after this review concluded. Surface the advisory and clear the flag — the review re-runs against the changed scope.

> *Output the next fenced block as a text code block (```text fence):*

```text
  ⚑ The implementation changed after this review concluded.
    Review the changed scope — the prior verdict predates it.
    Nothing has been overwritten.
```

Clear the flag:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs manifest delete {work_unit}.{downstream_phase}.{topic} reconcile_needed
```

→ Return to caller.
