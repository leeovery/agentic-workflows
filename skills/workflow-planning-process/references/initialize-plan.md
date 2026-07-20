# Initialize Plan

*Reference for **[workflow-planning-process](../SKILL.md)***

---

## A. Check Format Recommendation

Read the project default `plan_format` via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.defaults.plan_format
```

#### If output is empty (no project default)

→ Proceed to **B. Select Format**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Project default format is **{format}**. Use the same format?

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
3. Start the planning item — the engine creates it with `status: in-progress`:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} planning {topic}
   ```
4. Set the planning metadata — every same-path field in one batched write, then the project default (a different path, so its own call):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} format {chosen-format} spec_commit={commit-hash} task_list_gate_mode=gated author_gate_mode=gated finding_gate_mode=gated review_cycle=0 phase=1 task='~' task_map='{}'
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.defaults.plan_format {chosen-format}
   ```

5. Commit — the project default lands in `.workflows/manifest.json`, outside the work unit, so use the whole-tree scope:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "planning({work_unit}): initialize plan"
   ```

→ Return to caller.
