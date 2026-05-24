---
name: workflow-legacy-research-split
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-inception-process/scripts/discovery.cjs), Bash(git)
---

# Legacy Research Split

Act as **curator + interviewer**. Walk the user through decomposing legacy broad research files (from pre-inception epics) into topic-scoped research files that the discovery map can route around.

## Purpose in the Workflow

Bridges legacy epics into the inception model. Migration 038 seeded discovery-map items from existing research files, but those legacy files often contain multiple themes lumped under one broad name (e.g. `exploration.md` covering auth + caching + api-structure). Without intervention, automated analyses cannot fire (they only operate on completed material) and the map stays anchored to a single in-progress broad file.

This skill identifies qualifying legacy research files, presents their themes back to the user, and — with user approval — splits each broad file into topic-scoped files plus matching inception items, leaving the rest of the pipeline able to operate on per-topic granularity.

### What This Skill Needs

- **Work unit** (required) — the epic to normalise. Passed by `continue-epic` Step 5.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding
- Complete each step fully before moving to the next

---

## Step 1: List Qualifying Sources

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Legacy Research Split
●───────────────────────────────────────────────●

```

> *Output the next fenced block as markdown (not a code block):*

```
> This epic pre-dates the inception phase. Migration-seeded broad
> research files are decomposed here into topic-scoped themes,
> user-guided per source.
```

> *Output the next fenced block as a code block:*

```
── List Qualifying Sources ──────────────────────
```

Initialise `applied_count = 0` and `abandoned_count = 0` — Step 3 reads these for an honest closing message.

Load **[detect-trigger.md](references/detect-trigger.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Session Loop

> *Output the next fenced block as a code block:*

```
── Session Loop ─────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Iterating over qualifying source files. Each iteration presents
> themes for review and applies the user-approved split.
```

Load **[session-loop.md](references/session-loop.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Recovery From Interrupted Apply

If apply-split crashes or the session is killed between A (start) and E (finalise), the source's inception item is left with `legacy_split_state = in-progress`. detect-trigger then excludes the source from re-qualification — preventing content duplication on naive retry, but also locking the user out of re-running the split for that source.

Recovery is manual and surfaced via continue-epic's manage menu (if available) or the manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.inception.{stuck_source} legacy_split_state
```

After clearing the field:

- Inspect the source's research directory for orphan files (themes that apply-split A wrote but apply-split C never registered in the manifest). The orphans are `.workflows/{work_unit}/research/{name}.md` files with no corresponding `phases.research.items.{name}` entry. Either delete the orphans (cleanest — they will be re-created by the retry) or keep them (the retry will overwrite if the same theme name is proposed).
- Inspect for partial manifest items (research/inception items that apply-split C wrote but the apply never finished). Delete them via `manifest.cjs delete` if they correspond to themes that should re-derive on retry.
- Re-run `/continue-epic`. detect-trigger will re-qualify the source. Work through propose-candidates fresh.

---

## Step 3: Conclude

> *Output the next fenced block as a code block:*

```
── Legacy Split Complete ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. The closing line reflects what actually happened
> across the session.
```

Render the per-outcome message below based on `applied_count` and `abandoned_count`:

#### If `applied_count == 0` and `abandoned_count == 0`

Defensive branch — continue-epic Step 5 gates this path, so reaching here means the caller invoked the skill without gating.

> *Output the next fenced block as markdown (not a code block):*

```
> No legacy source files needed decomposition.
```

→ Return to caller.

#### If `applied_count > 0` and `abandoned_count == 0`

> *Output the next fenced block as markdown (not a code block):*

```
> Legacy broad research files decomposed. The discovery map now
> reflects topic-scoped items.
```

→ Return to caller.

#### If `applied_count > 0` and `abandoned_count > 0`

> *Output the next fenced block as markdown (not a code block):*

```
> {applied_count} source file(s) decomposed; {abandoned_count}
> skipped. Skipped files remain on the map and can be revisited
> on the next /continue-epic.
```

→ Return to caller.

#### If `applied_count == 0` and `abandoned_count > 0`

> *Output the next fenced block as markdown (not a code block):*

```
> No source files decomposed — every qualifying file was skipped.
> They remain on the map and can be revisited on the next
> /continue-epic.
```

→ Return to caller.
