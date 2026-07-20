# Session Setup

*Reference for **[workflow-specification-process](../SKILL.md)***

---

## Reset Gate Modes

Reset `finding_gate_mode` and `construction_gate_mode` to `gated` in one batched write:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} finding_gate_mode gated construction_gate_mode=gated
```

## Register Consult References

For each consult reference named in the handoff's `Consult references` block, register it as `pending` if it is not already tracked. Check first:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} consult_references.{ref}.status
```

If the result is empty (not yet registered), set it to `pending`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} consult_references.{ref}.status pending
```

**Never overwrite an existing status** — an already-`addressed` reference must stay `addressed`. This runs every session, so references newly declared on a continue are picked up while prior progress is preserved.

→ Return to caller.
