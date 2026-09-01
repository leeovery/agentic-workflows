# The Next Experiment, or the Menu

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

The record is terminal. When the series still holds live experiments the session can work the next one without leaving — the fresh-context control guards the spawning conversation's hopes, not sibling records. Read the series:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} experiments
```

#### If any top-level record is live (status neither `concluded` nor `abandoned`)

Fetch the gate and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-next-gate {work_unit}.experiment.{topic}
```

**STOP.** Wait for user response.

**If `n/next`:**

Load **[select-record.md](../../workflow-experiment-entry/references/select-record.md)** and follow its instructions as written — the same resolution the entry runs. On return, `{id}`, `{slug}`, and `{record_status}` name the next record; derive `{dir}` = `.workflows/{work_unit}/experiment/{topic}/{id}-{slug}`.

→ On return, return to **[the skill](../SKILL.md)** for **Step 1**.

**If `m/menu`:**

> *Output the next fenced block as markdown (not a code block):*

```
> The spawning conversation picks the evidence up at its next entry — the menu is the router.
```

Invoke `/workflow-bridge {work_unit} experiment`.

#### Otherwise

No record is live — nothing remains to work.

> *Output the next fenced block as markdown (not a code block):*

```
> The spawning conversation picks the evidence up at its next entry — the menu is the router.
```

Invoke `/workflow-bridge {work_unit} experiment`.
