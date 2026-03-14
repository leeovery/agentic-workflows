---
name: workflow-discussion-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-discussion-entry/scripts/discovery.js), Bash(mkdir -p .workflows/*/.state), Bash(rm .workflows/*/.state/research-analysis.md), Bash(node .claude/skills/workflow-manifest/scripts/manifest.js), Bash(ls .workflows/)
---

Invoke the **workflow-discussion-process** skill for this conversation.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 2** of the six-phase workflow:

| Phase              | Focus                                              | You    |
|--------------------|----------------------------------------------------|--------|
| 1. Research        | EXPLORE - ideas, feasibility, market, business     |        |
| **2. Discussion**  | WHAT and WHY - decisions, architecture, edge cases | ◀ HERE |
| 3. Specification   | REFINE - validate into standalone spec             |        |
| 4. Planning        | HOW - phases, tasks, acceptance criteria           |        |
| 5. Implementation  | DOING - tests first, then code                     |        |
| 6. Review          | VALIDATING - check work against artifacts          |        |

**Stay in your lane**: Capture the WHAT and WHY - decisions, rationale, competing approaches, edge cases. Don't jump to specifications, plans, or code. This is the time for debate and documentation.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them. Present output using the EXACT format shown in examples - do not simplify or alter the formatting.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Even if the user's initial prompt seems to answer a question, still confirm with them at the appropriate step
- Complete each step fully before moving to the next
- Do not act on gathered information until the skill is loaded - it contains the instructions for how to proceed

---

## Step 1: Parse Arguments

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Store work_unit for the handoff.

#### If `topic` resolved

Check if discussion phase entry exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.discussion.{topic}
```

**If exists (`true`):**

→ Proceed to **Step 2** (Validate Phase).

**If not exists (`false` — new entry):**

→ Proceed to **Step 7** (Gather Context) with source="new".

#### If no `topic` (epic — scoped path)

Run discovery scoped to this work unit:

```bash
node .claude/skills/workflow-discussion-entry/scripts/discovery.js {work_unit}
```

Parse the discovery output to understand:

**From `research` section:**
- `exists` - whether research files exist
- `files` - each research file's name and topic
- `checksum` - current checksum of all research files

**From `discussions` section:**
- `exists` - whether discussion entries exist (from manifests)
- `files` - each discussion's name, work_unit, status, and work_type
- `counts.in_progress` and `counts.completed` - totals for routing

**From `cache` section:**
- `entries` - array of cache entries (empty if no cache exists). Each entry has:
  - `status` - `"valid"` (checksums match) or `"stale"` (research changed)
  - `reason` - explanation of the status
  - `generated` - when the cache was created
  - `research_files` - list of files that were analyzed

**From `state` section:**
- `scenario` - one of: `"fresh"`, `"research_only"`, `"discussions_only"`, `"research_and_discussions"`

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 3** (Route Based on Scenario).

---

## Step 2: Validate Phase

Load **[validate-phase.md](references/validate-phase.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 3: Route Based on Scenario

Load **[route-scenario.md](references/route-scenario.md)** and follow its instructions as written.

#### If research exists

→ Proceed to **Step 4**.

#### If discussions only

→ Proceed to **Step 5**.

#### If fresh

→ Proceed to **Step 7**.

---

## Step 4: Research Analysis

Load **[research-analysis.md](references/research-analysis.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Present Options

Load **[display-options.md](references/display-options.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Handle Selection

Load **[handle-selection.md](references/handle-selection.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Gather Context

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
