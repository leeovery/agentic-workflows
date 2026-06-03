---
name: workflow-continue-epic
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-continue-epic/scripts/discovery.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs), Bash(node .claude/skills/workflow-discovery/scripts/discovery.cjs)
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
- Don't invent stops. Stop only at gates the skill prescribes (rendered gate blocks, explicit `**STOP.**` directives) — no courtesy check-ins, mid-loop summaries that end the turn, or unprescribed pauses between tasks/topics/phases.
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

Load **[casing-conventions.md](../workflow-shared/references/casing-conventions.md)** and follow its instructions as written.

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

!`node .claude/skills/workflow-continue-epic/scripts/discovery.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/workflow-continue-epic/scripts/discovery.cjs
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
  - `discovery_map` - per-topic lifecycle for the discovery/research/discussion span (tier-sorted; empty when no discovery items exist)
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

Run /workflow-start to begin a new one.
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

## Step 5: Backfill

Silent gate. Detects whether any one-time-per-project recovery work is needed; loads the dispatching reference only when work fires.

```bash
node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs {work_unit}
```

Parse `qualifying_sources` from the JSON output.

Then read `discovery_map` from the most recent discovery `detail` and filter for items where `summary_present` is false or `description_present` is false — regardless of `source`. Store the filtered list as `items_to_recover`.

#### If `qualifying_sources` is empty and `items_to_recover` is empty

→ Proceed to **Step 6**.

#### Otherwise

Load **[backfill-checks.md](references/backfill-checks.md)** with work_unit = `{work_unit}`, qualifying_sources = `{qualifying_sources}`, items_to_recover = `{items_to_recover}`.

backfill-checks is terminal when it fires — it commits the recovery work and stops, advising the user to `/clear` and re-run `/workflow-start`. Do not proceed to Step 6 on this branch.

---

## Step 6: Topic Discovery

> *Output the next fenced block as a code block:*

```
── Topic Discovery ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking whether completed research or discussion has new themes
> to surface onto the discovery map.
```

Read `analysis_caches` from the most recent discovery `detail`. Load **[topic-discovery-dispatch.md](../workflow-shared/references/topic-discovery-dispatch.md)** with work_unit = `{work_unit}`, analysis_caches = `{analysis_caches}`.

On return, `new_arrivals` is populated for Step 8 to render the callout.

→ Proceed to **Step 7**.

---

## Step 7: Sequence Map

> *Output the next fenced block as a code block:*

```
── Sequence Map ─────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Assigning a suggested execution order to the discovery map's topics.
```

Read `needs_sequencing` from the most recent discovery `detail`.

#### If `needs_sequencing` is true

Load **[sequence-discovery-map.md](../workflow-shared/references/sequence-discovery-map.md)** with work_unit = `{work_unit}`.

On return, re-run discovery so the display sees the new order:

```bash
node .claude/skills/workflow-continue-epic/scripts/discovery.cjs {work_unit}
```

→ Proceed to **Step 8**.

#### Otherwise

The map is already sequenced.

→ Proceed to **Step 8**.

---

## Step 8: Display State and Menu

> *Output the next fenced block as a code block:*

```
── Display State and Menu ───────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing the full phase-by-phase breakdown and available actions.
```

Load **[epic-display-and-menu.md](references/epic-display-and-menu.md)** with new_arrivals = `{new_arrivals}`.

→ Proceed to **Step 9**.

---

## Step 9: Route Selection

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
| Continue discovery | `/workflow-discovery epic {work_unit}` |

Skills receive positional arguments: `$0` = work_type (`epic`), `$1` = work_unit, `$2` = topic (when provided). "Continue discovery" routes to the discovery skill, which detects the existing work unit and re-shapes the map (existing-epic mode) — workflow-continue-epic navigates; discovery owns the shaping.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
