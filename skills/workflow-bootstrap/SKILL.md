---
name: workflow-bootstrap
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(mkdir -p .workflows/), Bash(cp), Bash(git)
---

Bootstrap a work unit after Discovery has resolved its shape. Single utility replacing the per-work-type start-* skills. Model-invocable only — Discovery's terminal step invokes it; users never reach it directly.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

You are at the boundary between **Discovery** and the next phase. Discovery committed the work-unit shape; your job is to land that commit on disk and hand off to the first work-type-appropriate phase entry:

Discovery → **Bootstrap** → {Research / Discussion / Investigation / Scoping}

**Stay in your lane**: do not gather context, do not classify shape, do not negotiate routing. Discovery already did. Your work is mechanical — create the manifest if it does not exist, land imports, route to the next phase.

### What This Skill Needs

The caller (Discovery's `conclude-discovery.md`) provides these via the handoff:

- `work_type` — required. One of `epic`, `feature`, `bugfix`, `quick-fix`, `cross-cutting`. Discovery resolved it.
- `work_unit` — required. The named work being bootstrapped.
- `routing` — required.
  - Epic: per-topic routing is already persisted on the discovery items; `routing` is unused
  - Feature / cross-cutting: `research` or `discussion`
  - Bugfix: fixed to `investigation`
  - Quick-fix: fixed to `scoping`
- `description` — optional. If the manifest already exists, the description on disk wins. Otherwise the provided description seeds the manifest.
- `imports_staging` — optional. Path to a staging directory holding files Discovery collected. Empty / absent when no imports were collected.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- Bootstrap is mechanical — do not introduce conversational beats
- Do not re-run Step 0 elements that `/workflow-start` already ran (casing, migrations, knowledge check, knowledge compact)
- After rendering a gate block (if any), the turn MUST end
- Complete each step fully before moving to the next

---

## Step 1: Ensure Manifest

Load **[ensure-manifest.md](references/ensure-manifest.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Land Imports

Load **[land-imports.md](references/land-imports.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Route to First Phase

Load **[route-to-phase.md](references/route-to-phase.md)** and follow its instructions as written.

This skill ends. The invoked entry-point skill will load and provide its own instructions. Terminal.
