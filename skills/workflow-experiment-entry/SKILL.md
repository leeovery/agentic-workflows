---
name: workflow-experiment-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

You are entering the **laboratory** — a topic's experiment series. Experiments are a tool research and discussion use: a conversation hits a question talking cannot settle, spawns a record, and the laboratory answers it — designed before it is measured, run as designed, reported with a one-line verdict. The spawn is the phase's one door; this skill only ever enters a series that already exists, and which record to work resolves inside it. Where the laboratory sits in the pipeline depends on the work type:

| Work type | Pipeline |
|---|---|
| Epic | Discovery → Research → **Experiment** (optional) → Discussion → Specification → Planning → Implementation → Review |
| Feature | Research (optional) → **Experiment** (optional) → Discussion → Specification → Planning → Implementation → Review |
| Cross-cutting | Research (optional) → **Experiment** (optional) → Discussion → Specification (terminal) |

Spawned from a Research or Discussion conversation; the verdict returns to the conversation that asked.

**Stay in your lane**: Measure, don't decide. An experiment answers its pre-registered question; the decision belongs to the conversation that spawned it, which reads the report as evidence and can override the verdict.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Step 1: Parse Arguments

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).

Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Store work_unit and work_type for the handoff.

→ Proceed to **Step 2**.

---

## Step 2: Validate the Series

Read the topic's experiment item status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} status
```

#### If the output is empty (no series)

Load **[validate-series.md](references/validate-series.md)** with series_state = `missing`.

#### If the output is `cancelled`

Load **[validate-series.md](references/validate-series.md)** with series_state = `cancelled`.

#### Otherwise

Read the series, storing the `experiments` subtree:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} experiments
```

→ Proceed to **Step 3**.

---

## Step 3: Select the Record

Load **[select-record.md](references/select-record.md)** and follow its instructions as written.

#### If the resolve returned no record (`b/back` from the picker)

> *Output the next fenced block as markdown (not a code block):*

```
> Nothing entered — the series stands as it is, and the menu is the way back.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

→ Proceed to **Step 4**.

---

## Step 4: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
