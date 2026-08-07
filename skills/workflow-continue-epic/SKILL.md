---
name: workflow-continue-epic
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-continue-epic/scripts/gateway.cjs), Bash(node .claude/skills/workflow-start/scripts/gateway.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs), Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(mkdir -p .workflows/)
---

Continue an in-progress epic. Shows full phase-by-phase state and routes to the appropriate phase skill.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Step 0: Initialisation

> *Output the next fenced block as markdown (not a code block):*

```
# **`■ Continue Epic`**
```

→ Proceed to **Step 1**.

---

## Step 1: Discovery State

!`node .claude/skills/workflow-continue-epic/scripts/gateway.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From the `=== EPICS (N) ===` section:**
- one line per active epic — `{name}: {active_phases}` (phases with items; `(no phases)` when none)
- `count` — the header count of active epics

**From the `=== COMPLETED (N) ===` / `=== CANCELLED (N) ===` sections:**
- one line per closed epic — `{name} (last phase: {phase})`
- `completed_count` / `cancelled_count` — the header counts

The per-epic state surface (`all_done`, `reconcile_pending`, `analysis_caches`, `needs_sequencing`, the discovery map) is the scoped dump Step 4 runs after validation; display and routing come from the `view` snapshot at Step 8.

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 2**.

---

## Step 2: Check Count and Arguments

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

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Select Epic`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing your active epics for selection.
```

Load **[select-epic.md](references/select-epic.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Validate Selection

Load **[validate-selection.md](references/validate-selection.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Backfill

```bash
node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs {work_unit}
```

Parse `qualifying_sources` from the JSON output.

Then read `discovery_map` from the most recent discovery output and filter for rows where `summary=absent` or `description=absent`. Store the filtered list as `items_to_recover`.

#### If `qualifying_sources` is empty and `items_to_recover` is empty

→ Proceed to **Step 6**.

#### Otherwise

Load **[backfill-checks.md](references/backfill-checks.md)** with work_unit = `{work_unit}`, qualifying_sources = `{qualifying_sources}`, items_to_recover = `{items_to_recover}`.

backfill-checks is terminal when recovery work landed — it commits and stops, advising the user to `/clear` and re-run `/workflow-start`. It returns only when nothing was written (the batch declined); the skipped items re-offer on the next entry.

→ On return, proceed to **Step 6**.

---

## Step 6: Topic Discovery

Read `analysis_caches` from the most recent discovery output. Load **[topic-discovery-dispatch.md](../workflow-shared/references/topic-discovery-dispatch.md)** with work_unit = `{work_unit}`, analysis_caches = `{analysis_caches}`.

On return, `new_arrivals` is populated for Step 8 to render the callout.

→ On return, proceed to **Step 7**.

---

## Step 7: Sequence Map

Read `needs_sequencing` from the most recent discovery output.

#### If `needs_sequencing` is true

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Sequence Map`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Assigning a suggested execution order to the map's topics.
```

Load **[sequence-discovery-map.md](../workflow-shared/references/sequence-discovery-map.md)** with work_unit = `{work_unit}`.

On return, re-run discovery so the display sees the new order:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs {work_unit}
```

→ On return, proceed to **Step 8**.

#### Otherwise

→ Proceed to **Step 8**.

---

## Step 8: Display State and Menu

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Epic State`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing the full phase-by-phase breakdown and available actions.
```

Load **[epic-display-and-menu.md](references/epic-display-and-menu.md)** with new_arrivals = `{new_arrivals}`.

→ On return, proceed to **Step 9**.

---

## Step 9: Route Selection

Invoke the `route` stored for the user's selection — the selected `ACTIONS` entry's route from epic-display-and-menu.md (e.g. `/workflow-discussion-entry epic {work_unit} {topic}`). Selections with route `(internal)` resolve inside that reference and never reach this step.

Skills receive positional arguments: `$0` = work_type (`epic`), `$1` = work_unit, `$2` = topic (when provided). The `continue_discovery` route hands to the discovery skill, which detects the existing work unit and re-shapes the map (existing-epic mode) — workflow-continue-epic navigates; discovery owns the shaping.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
