# The Next Experiment, or the Menu

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

A record ended, or moved beneath the session. When the series still holds live experiments the session can work the next one without leaving — the fresh-context control guards the spawning conversation's hopes, not sibling records. Read the series:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} experiments
```

#### If no top-level record is live (every status `concluded` or `abandoned`)

Nothing remains to work.

> *Output the next fenced block as markdown (not a code block):*

```
> The spawning conversation picks the evidence up at its next entry — the menu is the router.
```

Invoke `/workflow-bridge {work_unit} experiment`.

#### Otherwise

Fetch the gate and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-next-gate {work_unit}.experiment.{topic}
```

**STOP.** Wait for user response.

#### If `next`

Load **[select-record.md](../../workflow-experiment-entry/references/select-record.md)** and follow its instructions as written — the same resolution the entry runs.

**If a record resolved** (`{id}`, `{slug}`, `{record_status}` set):

Derive `{dir}` = `.workflows/{work_unit}/experiment/{topic}/{id}-{slug}`.

→ Return to **[the skill](../SKILL.md)** for **Step 1**.

**If the resolve returned no record** (`b/back` from the picker):

> *Output the next fenced block as markdown (not a code block):*

```
> The spawning conversation picks the evidence up at its next entry — the menu is the router.
```

Invoke `/workflow-bridge {work_unit} experiment`.

#### If `menu`

> *Output the next fenced block as markdown (not a code block):*

```
> The spawning conversation picks the evidence up at its next entry — the menu is the router.
```

Invoke `/workflow-bridge {work_unit} experiment`.
