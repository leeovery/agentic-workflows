# The Next Experiment, or the Menu

*Reference for **[ledger-experiment-process](../SKILL.md)***

---

## A. Read the Series

A record ended, or moved beneath the session. Re-render the register, the series moved:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}
```

When the series still holds live experiments the session can work the next one without leaving — the fresh-context control guards the spawning conversation's hopes, not sibling records. Read the series:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} experiments
```

#### If no top-level record is live (every status `concluded` or `abandoned`)

Nothing remains to work.

> *Output the next fenced block as markdown (not a code block):*

```
> The spawning conversation picks the evidence up at its next entry.
```

Load **[handing-off.md](../../ledger-shared/references/handing-off.md)** with route = `unit {work_unit}`.

#### Otherwise

→ Proceed to **B. Offer the Next Experiment**.

## B. Offer the Next Experiment

Fetch the gate:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render experiment-next-gate {work_unit}.experiment.{topic}
```

**STOP.** Wait for user response.

#### If `yes`

Load **[select-record.md](select-record.md)** and follow its instructions as written — the same resolution the session setup runs.

**If a record resolved** (`{id}`, `{slug}`, `{record_status}` set):

Derive `{dir}` = `.ledger/{work_unit}/topics/{topic}/experiments/{id}-{slug}`.

→ Return to **[the skill](../SKILL.md)** for **Step 1**.

**If the resolve returned no record** (`b/back` from the picker):

Nothing was picked: follow the back's `next`, and take the answer of the gate it draws as this section does.

#### If `menu`

> *Output the next fenced block as markdown (not a code block):*

```
> The spawning conversation picks the evidence up at its next entry.
```

Follow the answer's `next`.
