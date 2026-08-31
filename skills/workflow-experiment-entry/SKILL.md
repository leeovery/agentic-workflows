---
name: workflow-experiment-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

You are entering the **laboratory** — one experiment record in a topic's series. Experiments are a tool research and discussion use: a conversation hits a question talking cannot settle, spawns the record, and the laboratory answers it — designed before it is measured, run as designed, reported with a one-line verdict. The spawn is the phase's one door; this skill only ever enters a record that already exists.

**Stay in your lane**: Measure, don't decide. An experiment answers its pre-registered question; the decision belongs to the conversation that spawned it, which reads the report as evidence and can override the verdict.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Step 1: Parse Arguments

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2`, experiment id = `$3`.

Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`. When work_type is not `epic` and `$2` matches the id shape (`E{n}` or `E{n}.{m}`), `$2` is the experiment id and topic = `$1` — topics are kebab-case names, never ids.

Store work_unit and work_type for the handoff. Store the experiment id as `{id}` when one was supplied; Step 3 resolves it otherwise.

→ Proceed to **Step 2**.

---

## Step 2: Read the Series

Read the topic's experiment item status and its series:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} status
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} experiments
```

#### If the status read is empty (no series)

> *Output the next fenced block as markdown (not a code block):*

```
# **`■ Experiment`**
```

> *Output the next fenced block as a properties code block (```properties fence):*

```properties
⚑ No experiment series exists for this topic
```

> Experiments are spawned from a research or discussion session — the spawn is the phase's one door. Raise the question in the conversation that needs it measured.

**STOP.** Do not proceed — terminal condition.

#### If the status read is `cancelled`

> *Output the next fenced block as markdown (not a code block):*

```
# **`■ Experiment`**
```

> *Output the next fenced block as a properties code block (```properties fence):*

```properties
⚑ The experiment series for this topic is cancelled
```

> Reactivate it from the menu to work its records again.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Store the `experiments` subtree from the second read.

→ Proceed to **Step 3**.

---

## Step 3: Resolve the Record

#### If `{id}` was supplied

Look it up in the stored subtree. A sub-experiment id (`E{n}.{m}`) never enters directly — a split is walked inside its parent's run: say so in one line, and take the parent id (`E{n}`) as `{id}` instead. An id the series does not hold: say so in one line, then follow the ask below.

When the record is found, store its `status` as `{record_status}` and its `slug` as `{slug}`.

→ Proceed to **Step 4**.

#### If no `{id}` was supplied

Render the register and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}
```

> *Output the next fenced block as markdown (not a code block):*

```
Which experiment should this session enter? Give its id (E1, E2, …).
```

**STOP.** Wait for user response.

Store the response as `{id}` and look it up in the stored subtree — an unknown or sub-experiment id is handled as above. Store the record's `status` as `{record_status}` and its `slug` as `{slug}`.

→ Proceed to **Step 4**.

---

## Step 4: Validate the Record

Load **[validate-record.md](references/validate-record.md)** with record_status = `{record_status}`.

→ On return, proceed to **Step 5**.

---

## Step 5: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
