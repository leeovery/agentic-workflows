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

→ Return to caller.
