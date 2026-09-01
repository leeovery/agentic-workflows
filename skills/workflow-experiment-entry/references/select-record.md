# Select the Record

*Reference for **[workflow-experiment-entry](../SKILL.md)***

---

Resolve which experiment this session works — the entry is per-topic, and the record resolves here. Loaded by the entry backbone and by the return leg's next pick ([next-experiment.md](../../workflow-experiment-process/references/next-experiment.md)). On return, `{id}`, `{slug}`, and `{record_status}` name a live record — or a `b/back` from the picker resolves no record, and the caller routes the back-out.

The caller holds the series — the `experiments` subtree. Count its **live top-level records**: ids without a dot whose status is neither `concluded` nor `abandoned`.

## A. Resolve by Count

#### If exactly one record is live

Nothing to ask — store the record's id as `{id}`, its `status` as `{record_status}`, and its `slug` as `{slug}`; the note in **C** is the announce.

→ Proceed to **C. Announce the Record**.

#### If several records are live

Nothing upstream chose a record — the pick is the user's.

→ Proceed to **B. Pick From the Register**.

#### If no record is live

Every row is terminal — the series is finished.

> *Output the next fenced block as a properties code block (```properties fence):*

```
⚑ Every experiment in this series is finished
```

> *Output the next fenced block as markdown (not a code block):*

```
> The series' rows stand on the register; a new spawn from the topic's research or discussion starts the next experiment — reopen that conversation first if it has concluded.
```

**STOP.** Do not proceed — terminal condition.

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

An id answer resolves to its top-level record first: a sub-experiment answer (`E{n}.{m}`) resolves to its parent `E{n}` — a split is walked inside its parent's run.

**If `back`:**

No record resolves.

→ Return to caller.

**If the series does not hold the resolved id, or its record is terminal (`concluded` or `abandoned`):**

Unknown ids — parent or sub — and finished records alike: say so in one line.

→ Return to **B. Pick From the Register**.

**If the answer named a sub-experiment:**

Say the split is walked inside its parent's run in one line, then store the parent record: `{id}` = `E{n}`, its `status` as `{record_status}`, its `slug` as `{slug}`.

→ Proceed to **C. Announce the Record**.

**Otherwise:**

Store the record's id as `{id}`, its `status` as `{record_status}`, and its `slug` as `{slug}`.

→ Proceed to **C. Announce the Record**.

## C. Announce the Record

Branch on `{record_status}` — no re-read. The note is the entry's one announce, and rendering it claims the topic's slot.

#### If status is `conceived`

A fresh record — the spawn conceived it and no laboratory session has run. Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.experiment.{topic} --verb Starting --noun {id}
```

→ Return to caller.

#### Otherwise

A record in flight (`designed`, `approved`, or `running`). Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.experiment.{topic} --verb Resuming --noun {id}
```

→ Return to caller.
