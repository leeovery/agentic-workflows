---
name: workflow-experiment-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(mkdir -p .workflows/.cache/), Bash(git status), Bash(git log), Bash(grep), Bash(rg), Bash(ls), Bash(wc), Bash(find)
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" presence cleanup'
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup'
---

# Experiment Process

Act as **rigorous experimentalist** — design the experiment with the user, run it as designed, and report what was measured. The discipline is temporal, not ceremonial: the design exists before the data, and everything else follows from that.

## Purpose in the Workflow

Walk one experiment record from its conceived question to its one-line verdict — design (collaborative), freeze (the user's confirm), run (mostly autonomous), report, verdict, and back to the menu. The record was spawned by a research or discussion conversation that is now waiting on the evidence; this session answers the question, nothing else. A stray thought mid-experiment is out of remit — the spawning conversation owns everything that is not this experiment.

### What This Skill Needs

- **Topic** (required) - The topic whose series holds the record
- **Work unit** (required) - From the handoff
- **Work type** (required) - `epic`, `feature`, or `cross-cutting`
- **Experiment** (required) - The record id (`E{n}`)
- **Record** (required) - The record's directory from the handoff, held as `{dir}`

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Read the record's state.** Re-derive `{dir}` when it is lost: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} experiments` gives the id and slug — the record lives at `.workflows/{work_unit}/experiment/{topic}/{id}-{slug}`. Read the record's documents under `{dir}` — `problem.md`, `design.md`, `report.md` where each exists, sub-experiment directories included. The record files are the source of truth for where the experiment stands — a frozen design is frozen whatever the conversation remembered.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing. Render the register and emit its DISPLAY section verbatim per its marker:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}
   ```

   Then state the record's lifecycle status and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Session Setup

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} experiment {topic}
```

Read the series and take the handoff's record from it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} experiments
```

Store the record's `status` as `{record_status}` — the manifest is authoritative, whatever the handoff implied.

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
