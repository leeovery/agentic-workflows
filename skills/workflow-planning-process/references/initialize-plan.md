# Initialize Plan

*Reference for **[workflow-planning-process](../SKILL.md)***

---

## A. Plan Context

Render the offer to add what has changed since the specification completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render plan-context-gate {work_unit}.planning.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

#### If `continue`

The plan carries the specification as it stands.

→ Proceed to **B. Cross-Cutting Context**.

#### If the user adds context

Hold the user's response as the plan context.

→ Proceed to **B. Cross-Cutting Context**.

---

## B. Cross-Cutting Context

→ Load **[cross-cutting-context.md](cross-cutting-context.md)** and follow its instructions as written.

→ On return, proceed to **C. Check Format Recommendation**.

---

## C. Check Format Recommendation

Read the project default `plan_format` via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.defaults.plan_format
```

#### If output is empty (no project default)

→ Proceed to **D. Select Format**.

#### Otherwise

The surface reads the default itself and names it in both the label and the accept row:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render plan-format-gate
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **E. Register Plan**.

**If `no`:**

→ Proceed to **D. Select Format**.

---

## D. Select Format

→ Load **[output-formats.md](output-formats.md)** with phase = `planning`.

→ Load the chosen format's **[about.md](output-formats/{chosen-format}/about.md)** and follow its Setup section — complete any prerequisites (installation, initialisation, MCP configuration) before tasks are written.

→ On return, proceed to **E. Register Plan**.

---

## E. Register Plan

1. Load **[format-version-check.md](../../workflow-shared/references/format-version-check.md)** with format = `{chosen-format}`.
2. Capture the current git commit hash: `git rev-parse HEAD`
3. Create the planning file at `.workflows/{work_unit}/planning/{topic}/planning.md` with the title `# Plan: {topic:(titlecase)}`, then a section for each input **A** and **B** gathered — written only where it has content, and read from here for the rest of the plan:
   - `## Plan Context` — the context the user added at **A**, in their words.
   - `## Cross-Cutting References` — one bullet per specification **B** held: its work unit in bold, its specification path, and its summary.
4. Start the planning item — the engine creates it with `status: in-progress`:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} planning {topic}
   ```
5. Set the planning metadata — every same-path field in one batched write, then the project default (a different path, so its own call). `storage_paths` is the fenced JSON array in the format's **[authoring.md](output-formats/{chosen-format}/authoring.md)** → Storage Pathspecs — copy the array exactly as declared:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} format={chosen-format} spec_commit={commit-hash} task_list_gate_mode=gated author_gate_mode=gated finding_gate_mode=gated review_cycle=0 phase=1 task='~' task_map='{}' storage_paths='{format storage pathspecs}'
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.defaults.plan_format {chosen-format}
   ```

6. Commit — `--plan` stages the planning topic, the work-unit manifest, the project manifest, and the plan's declared storage in one scoped call:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): initialize plan" --plan {topic}
   ```

→ Return to caller.
