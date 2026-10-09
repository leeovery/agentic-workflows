---
name: workflow-continue-epic
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-continue-epic/scripts/gateway.cjs), Bash(node .claude/skills/workflow-start/scripts/gateway.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs), Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(mkdir -p .workflows/), Bash(mkdir -p .workflows/*/.state), Bash(rm .workflows/*/.state/discussion-consolidation-analysis.md)
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

This skill receives positional arguments — one not given is unset, whatever an earlier skill in this conversation held under the same name:
- `$0` — **work_unit**: the epic to continue. Held downstream as `{work_unit}`.
- `$1` — **completed_phase** (optional): the phase that just concluded or paused, where the epic arrives from one. Held downstream as `{completed_phase}`.
- `$2` — **outcome**: given with `$1` — `completed`, `paused`, `cancelled` or `postponed`. Held downstream as `{outcome}`.

Run the scoped discovery for the epic and hold its output as **the most recent discovery output** — Steps 2–6 read `discovery_map`, `analysis_caches`, `needs_sequencing`, `build_order_needs_sequencing`, and `all_done` from it; display and routing come from the `view` snapshot at Step 6:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs {work_unit}
```

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

#### If the output reports an `error`

Fetch the terminal display — the `view` snapshot for a name with no active epic behind it carries it:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs view {work_unit}
```

Emit its `DISPLAY: not found` section verbatim per its marker.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

→ Proceed to **Step 2**.

---

## Step 2: Backfill

Record where this session is working — the call also labels the tmux session where the user opted in:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit}
```

Run the legacy research-split detector:

```bash
node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs {work_unit}
```

Parse `qualifying_sources` from the JSON output.

Then read `discovery_map` from the most recent discovery output and filter for rows where `summary=absent` or `description=absent`. Store the filtered list as `items_to_recover`.

#### If `qualifying_sources` is empty and `items_to_recover` is empty

→ Proceed to **Step 3**.

#### Otherwise

Load **[backfill-checks.md](references/backfill-checks.md)** with work_unit = `{work_unit}`, qualifying_sources = `{qualifying_sources}`, items_to_recover = `{items_to_recover}`, completed_phase = `{completed_phase}`, outcome = `{outcome}`.

backfill-checks is terminal when recovery work landed — it commits and hands the epic menu off to start afresh, carrying the arguments it arrived with. It returns only when nothing was written (the batch declined); the skipped items re-offer on the next entry.

→ On return, proceed to **Step 3**.

---

## Step 3: Topic Discovery

Read `analysis_caches` from the most recent discovery output. Load **[topic-discovery-dispatch.md](../workflow-shared/references/topic-discovery-dispatch.md)** with work_unit = `{work_unit}`, analysis_caches = `{analysis_caches}`.

On return, `new_arrivals` is populated for Step 6 to render the callout.

→ On return, proceed to **Step 4**.

---

## Step 4: Sequence Map

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

Hold the refreshed output as the most recent discovery output.

→ On return, proceed to **Step 5**.

#### Otherwise

→ Proceed to **Step 5**.

---

## Step 5: Sequence Build Order

Read `build_order_needs_sequencing` from the most recent discovery output.

#### If `build_order_needs_sequencing` is true

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Sequence Build Order`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Assigning the build order across the specification topics.
```

Load **[sequence-build-order.md](../workflow-shared/references/sequence-build-order.md)** with work_unit = `{work_unit}`.

→ On return, proceed to **Step 6**.

#### Otherwise

→ Proceed to **Step 6**.

---

## Step 6: Display State and Menu

Load **[banner-and-completion.md](references/banner-and-completion.md)** and follow its instructions as written, then show the epic.

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Epic State`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing the full phase-by-phase breakdown and available actions.
```

Load **[epic-display-and-menu.md](references/epic-display-and-menu.md)** with new_arrivals = `{new_arrivals}`.

→ On return, proceed to **Step 7**.

---

## Step 7: Route Selection

The user's selection carries the `route` epic-display-and-menu.md stored for it, e.g. `/workflow-discussion-process epic {work_unit} {topic}`. Selections whose flows resolve inside that reference never reach this step.

Load **[handing-off.md](../workflow-shared/references/handing-off.md)** with route = `{route}`.
