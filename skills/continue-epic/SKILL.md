---
name: continue-epic
allowed-tools: Bash(node .claude/skills/continue-epic/scripts/discovery.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

Continue an in-progress epic. Shows full phase-by-phase state and routes to the appropriate phase skill.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate `*_gate_mode: auto` value in the manifest, set by the user's explicit `a`/`auto` choice at a prior gate.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next

---

## Step 0: Initialisation

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Continue Epic
●───────────────────────────────────────────────●

```

> *Output the next fenced block as a code block:*

```
── Initialisation ───────────────────────────────
```

### Step 0.1: Casing Conventions

Load **[casing-conventions.md](../workflow-shared/references/casing-conventions.md)** and follow its instructions as written.

→ Proceed to **Step 0.2**.

### Step 0.2: Migrations

#### If the `/workflow-migrate` skill has already been invoked in this conversation

→ Proceed to **Step 0.3**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
> Running migrations to keep workflow files in sync.
```

**Run migrations — this is mandatory. You must complete it before proceeding.**

Invoke the `/workflow-migrate` skill and follow its instructions exactly — if it issues a STOP gate, you must stop.

**CRITICAL**: When the migrate skill returns (either after committing changes or reporting no changes needed), you MUST continue to **Step 0.3**. Do not stop after migration completes.

→ Proceed to **Step 0.3**.

### Step 0.3: Knowledge Check

Load **[knowledge-check.md](../workflow-knowledge/references/knowledge-check.md)** and follow its instructions as written.

→ Proceed to **Step 1**.

---

## Step 1: Discovery State

> *Output the next fenced block as a code block:*

```
── Run Discovery ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Scanning for active epics and their current progress.
```

!`node .claude/skills/continue-epic/scripts/discovery.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/continue-epic/scripts/discovery.cjs
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From `epics` array:** Each epic has:
- `name` - the work unit name
- `active_phases` - list of phase names that have artifacts
- `detail` - full phase-by-phase breakdown containing:
  - `phases` - per-phase items with statuses and spec sources
  - `in_progress` - items currently in-progress (name + phase)
  - `completed` - items that are completed (name + phase)
  - `next_phase_ready` - items ready for the next phase (name + action + label)
  - `unaccounted_discussions` - completed discussions not sourced in any spec
  - `reopened_discussions` - in-progress discussions that are sourced in a spec
  - `discovery_map` - per-topic lifecycle for the inception/research/discussion span (tier-sorted; empty when no inception items exist)
  - `convergence_state` - `'in-progress'` | `'settled'` | `null` (when no map)
  - `map_summary` - count totals for the map (`total`, `decided`, `in_flight`, `ready`, `fresh`, `cancelled`)
  - `gating` - boolean flags for phase-forward gating

**From top-level fields:**
- `count` - number of active epics
- `summary` - human-readable state summary
- `completed` / `cancelled` - arrays of non-active epics with name, status, last_phase (list mode only)
- `completed_count` / `cancelled_count` - counts for each

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 2**.

---

## Step 2: Check Count and Arguments

> *Output the next fenced block as a code block:*

```
── Check State ──────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking if there are any epics in progress.
```

#### If `count` is 0

> *Output the next fenced block as a code block:*

```
No epics in progress.

Run /start-epic to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### If `work_unit` argument `$0` provided

Store the work_unit.

→ Proceed to **Step 4**.

#### If `work_unit` not provided

→ Proceed to **Step 3**.

---

## Step 3: Select Epic

> *Output the next fenced block as a code block:*

```
── Select Epic ──────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing your active epics for selection.
```

Load **[select-epic.md](references/select-epic.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Validate Selection

> *Output the next fenced block as a code block:*

```
── Validate Selection ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Confirming the selected epic exists and is active.
```

Load **[validate-selection.md](references/validate-selection.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Self-Healing

> *Output the next fenced block as a code block:*

```
── Self-Healing ─────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking analysis caches for the selected epic. Stale caches
> trigger inline research-analysis or gap-analysis runs that add
> any new themes directly to the discovery map.
```

Read `analysis_caches` from the selected epic's `detail` (parsed in Step 1):

- `analysis_caches.research_analysis.status` — `valid` | `stale` | `absent`
- `analysis_caches.gap_analysis.status` — same

#### If both caches are `valid` or `absent`

No analyses to run.

→ Proceed to **Step 6**.

#### If at least one cache is `stale`

→ Load **[self-healing.md](../workflow-shared/references/self-healing.md)** with work_unit = `{work_unit}`.

On return, store the orchestrator's `new_arrivals` tracker in conversation memory — Step 7 reads it to render the callout above the discovery map.

Re-run discovery for the work unit so Step 6 (summary backfill) and Step 7 (display) have fresh state including auto-added items:

```bash
node .claude/skills/continue-epic/scripts/discovery.cjs {work_unit}
```

→ Proceed to **Step 6**.

---

## Step 6: Summary Backfill

Read `discovery_map` from the selected epic's `detail`. Filter for items where `source` starts with `'migration-seeded'` and `summary` is null or missing.

#### If no items match

→ Proceed to **Step 7**.

#### If one or more items match

Store the filtered list as `items_to_recover`.

Load **[summary-backfill.md](references/summary-backfill.md)** with work_unit = `{work_unit}`, items_to_recover = `{items_to_recover}`.

→ Proceed to **Step 7**.

---

## Step 7: Display State and Menu

> *Output the next fenced block as a code block:*

```
── Display State and Menu ───────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing the full phase-by-phase breakdown and available actions.
```

Load **[epic-display-and-menu.md](references/epic-display-and-menu.md)** with new_arrivals = `{new_arrivals}` (or empty when Step 5 did not load the orchestrator).

→ Proceed to **Step 8**.

---

## Step 8: Route Selection

> *Output the next fenced block as a code block:*

```
── Route Selection ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the selected phase for this epic.
```

Invoke the appropriate skill based on the user's menu selection. Match by **prefix** — labels may carry a trailing context segment (e.g., `— research completed`, `— spec completed`, `(Phase 2, Task 3)`) which doesn't change the routing target.

| Menu option | Invoke |
|-------------|--------|
| Start research for {topic} | `/workflow-research-entry epic {work_unit} {topic}` |
| Start discussion for {topic} | `/workflow-discussion-entry epic {work_unit} {topic}` |
| Continue {topic} — discussion | `/workflow-discussion-entry epic {work_unit} {topic}` |
| Continue {topic} — research | `/workflow-research-entry epic {work_unit} {topic}` |
| Continue {topic} — specification | `/workflow-specification-entry epic {work_unit} {topic}` |
| Continue {topic} — planning | `/workflow-planning-entry epic {work_unit} {topic}` |
| Continue {topic} — implementation | `/workflow-implementation-entry epic {work_unit} {topic}` |
| Continue {topic} — review | `/workflow-review-entry epic {work_unit} {topic}` |
| Start planning for {topic} | `/workflow-planning-entry epic {work_unit} {topic}` |
| Start implementation of {topic} | `/workflow-implementation-entry epic {work_unit} {topic}` |
| Start review for {topic} | `/workflow-review-entry epic {work_unit} {topic}` |
| Start specification | `/workflow-specification-entry epic {work_unit}` |
| Start new discussion topic | `/workflow-discussion-entry epic {work_unit}` |
| Start new research | `/workflow-research-entry epic {work_unit}` |
| Refine map | `/workflow-inception-entry epic {work_unit}` |

Skills receive positional arguments: `$0` = work_type (`epic`), `$1` = work_unit, `$2` = topic (when provided).

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
