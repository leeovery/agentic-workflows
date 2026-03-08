---
name: workflow-investigation-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js), Bash(.claude/hooks/workflows/write-session-state.sh)
---

Invoke the **technical-investigation** skill for this conversation.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 1** of the bugfix pipeline:

| Phase              | Focus                                              | You    |
|--------------------|----------------------------------------------------|--------|
| **Investigation**  | Symptom gathering + code analysis → root cause     | ◀ HERE |
| 2. Specification   | REFINE - validate into fix specification           |        |
| 3. Planning        | HOW - phases, tasks, acceptance criteria           |        |
| 4. Implementation  | DOING - tests first, then code                     |        |
| 5. Review          | VALIDATING - check work against artifacts          |        |

**Stay in your lane**: Investigate the bug — gather symptoms, trace code, find root cause. Don't jump to fixing or implementing. This is the time for deep analysis.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Complete each step fully before moving to the next

---

## Step 1: Parse Arguments

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Investigation is always bugfix work_type. Store work_type and work_unit for the handoff.

Check investigation phase status via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase investigation --topic {topic} status
```

**If phase exists (in-progress or concluded):**

→ Proceed to **Step 2** (Validate Phase).

**If phase not found (new entry):**

Set source="new".

→ Proceed to **Step 3** (Gather Bug Context).

---

## Step 2: Validate Phase

Load **[validate-phase.md](references/validate-phase.md)** and follow its instructions as written.

#### If source is `continue`

→ Proceed to **Step 4**.

#### Otherwise

→ Proceed to **Step 3**.

---

## Step 3: Gather Bug Context

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
