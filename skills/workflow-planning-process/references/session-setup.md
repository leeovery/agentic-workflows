# Session Setup

*Reference for **[workflow-planning-process](../SKILL.md)***

---

1. Read the `format` from the manifest:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
   ```
2. Load the format's **[about.md](output-formats/{format}/about.md)** and **[authoring.md](output-formats/{format}/authoring.md)**
3. Reset gate modes to `gated` in the manifest — one batched write:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} task_list_gate_mode gated author_gate_mode=gated finding_gate_mode=gated
   ```

Never touch `spec_commit` here — it is the baseline spec-change detection diffs against, stamped at plan initialization and re-stamped only when the plan concludes.

→ Return to caller.
