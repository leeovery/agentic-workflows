---
name: workflow-continue-epic
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-continue-epic/scripts/gateway.cjs), Bash(node .claude/skills/workflow-start/scripts/gateway.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs), Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(tick), Bash(mkdir -p .workflows/)
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

> *Output the next fenced block as markdown (not a code block):*

```
> Loading shared display conventions for this session.
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

!`node .claude/skills/workflow-continue-epic/scripts/gateway.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From the `=== EPICS ===` section:**
- one line per active epic — `{name}: {active_phases}` (phases with items; `(no phases)` when none)
- `count` — the header count of active epics

**From the `=== COMPLETED ===` / `=== CANCELLED ===` sections:**
- one line per closed epic — `{name} (last phase: {phase})`
- `completed_count` / `cancelled_count` — the header counts

The per-epic state surface (`all_done`, `analysis_caches`, `needs_sequencing`, the discovery map) is the scoped dump Step 4 runs after validation; display and routing come from the `view` snapshot at Step 8.

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

Then read `discovery_map` from the most recent discovery output and filter for rows where `summary=absent` or `description=absent`. Store the filtered list as `items_to_recover`.

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

Read `analysis_caches` from the most recent discovery output. Load **[topic-discovery-dispatch.md](../workflow-shared/references/topic-discovery-dispatch.md)** with work_unit = `{work_unit}`, analysis_caches = `{analysis_caches}`.

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

Read `needs_sequencing` from the most recent discovery output.

#### If `needs_sequencing` is true

Load **[sequence-discovery-map.md](../workflow-shared/references/sequence-discovery-map.md)** with work_unit = `{work_unit}`.

On return, re-run discovery so the display sees the new order:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs {work_unit}
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

Invoke the `route` stored for the user's selection — the selected `ACTIONS` entry's route from epic-display-and-menu.md (e.g. `/workflow-discussion-entry epic {work_unit} {topic}`). Selections with route `(internal)` resolve inside that reference and never reach this step.

Skills receive positional arguments: `$0` = work_type (`epic`), `$1` = work_unit, `$2` = topic (when provided). The `continue_discovery` route hands to the discovery skill, which detects the existing work unit and re-shapes the map (existing-epic mode) — workflow-continue-epic navigates; discovery owns the shaping.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
