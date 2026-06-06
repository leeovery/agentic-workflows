# Session Setup

*Reference for **[workflow-specification-process](../SKILL.md)***

---

Reset `finding_gate_mode` and `construction_gate_mode` to `gated` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} finding_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} construction_gate_mode gated
```

→ Return to caller.
