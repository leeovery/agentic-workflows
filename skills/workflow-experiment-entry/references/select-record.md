# Select the Record

*Reference for **[workflow-experiment-entry](../SKILL.md)***

---

## A. Resolve the Id

#### If `{id}` is set

Look it up in the stored `experiments` subtree.

**If `{id}` is a sub-experiment (`E{n}.{m}`):** a split is walked inside its parent's run — say so in one line and take the parent id (`E{n}`) as `{id}`.

→ Return to **A. Resolve the Id**.

**If the series does not hold `{id}`:** say so in one line.

→ Proceed to **B. Pick From the Register**.

**Otherwise:** store the record's `status` as `{record_status}` and its `slug` as `{slug}`.

→ Return to caller.

#### If no `{id}` is set

→ Proceed to **B. Pick From the Register**.

## B. Pick From the Register

Render the register and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}
```

Fetch the picker and emit its MENU section verbatim per its marker, directly beneath the register:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-pick {work_unit}.experiment.{topic}
```

**STOP.** Wait for user response.

Store the response as `{id}`.

→ Return to **A. Resolve the Id**.
