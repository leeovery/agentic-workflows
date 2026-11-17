---
name: ledger-experiment-process
description: Ledger's experiment phase. Reached only through a Ledger handoff, never invoked directly; work comes into Ledger through /ledger.
user-invocable: false
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

# Experiment Process

Act as **rigorous experimentalist** — design the experiment with the user, run it as designed, and report what was measured. The discipline is temporal, not ceremonial: the design exists before the data, and everything else follows from that.

## Purpose

Walk one experiment record from its conceived question to its one-line verdict — design (collaborative), freeze (the user's confirm), run (mostly autonomous), report, verdict, and back to the menu. The record was spawned by a discussion that is now waiting on the evidence; this session answers the question, nothing else.

### What This Skill Needs

Positional arguments:
- `$0` — **work_type**: `epic` or `feature`.
- `$1` — **work_unit**: the work unit name.
- `$2` — **topic**: the topic whose series holds the record. A single-topic unit's topic is the work unit, so it may be left off: topic = `$2`, or `$1` where `work_type` is not `epic`.

The record — its id held as `{id}`, its directory as `{dir}` — resolves from the series at Step 0.

---

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

---

## Step 0: Session Setup

Read the series, storing the `experiments` subtree:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} experiments
```

Load **[select-record.md](references/select-record.md)** and follow its instructions as written.

**If the resolve returned no record** (`b/back` from the picker):

> *Output the next fenced block as markdown (not a code block):*

```
> Nothing entered — the series stands as it is.
```

Follow the back's `next`.

**Otherwise:**

Derive `{dir}` = `.ledger/{work_unit}/topics/{topic}/experiments/{id}-{slug}`.

Record where this session is working — the call also labels the session where the user opted in:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs session label {work_unit} experiment {topic}
```

→ Proceed to **Step 1**.

---

## Step 1: Guidelines and Initialization

Load **[experiment-guidelines.md](references/experiment-guidelines.md)** and follow its instructions as written.

Load **[initialize-experiment.md](references/initialize-experiment.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

---

## Step 2: Design

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Design`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> The design is written before anything is measured — question, prediction, decision rule, and setup, shaped together in conversation.
```

Load **[design-experiment.md](references/design-experiment.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Briefing

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Briefing`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> The design in plain terms — what we'll do, what we expect and why, what each outcome triggers. Your confirm freezes it.
```

Load **[briefing.md](references/briefing.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Run

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Run`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Measuring as designed. The run is mostly autonomous — the collaboration was front-loaded into the design — and deviations are logged as they happen.
```

Load **[run-experiment.md](references/run-experiment.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Report and Verdict

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Report and Verdict`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> The results are read against the pre-registered decision rule, and the verdict — the rule's mechanical outcome — is recorded on the register.
```

Load **[conclude-experiment.md](references/conclude-experiment.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

---

## Step 6: The Next Experiment, or the Menu

Load **[next-experiment.md](references/next-experiment.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.
