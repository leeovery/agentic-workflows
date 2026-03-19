# Initialize Plan

*Reference for **[workflow-planning-process](../SKILL.md)***

---

## A. Check Format Recommendation

Check if phase-level `format` exists via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.planning format
```

#### If `false`

→ Proceed to **B. Select Format**.

#### Otherwise

Read phase-level `format` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning format
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Existing plans use **{format}**. Use the same format?

- **`y`/`yes`** — Use {format}
- **`n`/`no`** — See all available formats
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **C. Register Plan**.

**If `no`:**

→ Proceed to **B. Select Format**.

---

## B. Select Format

→ Load **[output-formats.md](output-formats.md)** and follow its instructions as written.

→ Proceed to **C. Register Plan**.

---

## C. Register Plan

1. Capture the current git commit hash: `git rev-parse HEAD`
2. Create the planning file at `.workflows/{work_unit}/planning/{topic}/planning.md` with the title `# Plan: {Topic Name}`.
3. Register planning and set metadata in the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.planning.{topic}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} format {chosen-format}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning format {chosen-format}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} spec_commit {commit-hash}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task_list_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} author_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} finding_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} phase 1
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task ~
   ```

4. Commit: `planning({work_unit}): initialize plan`

→ Return to caller.
