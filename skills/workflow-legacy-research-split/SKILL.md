---
name: workflow-legacy-research-split
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/validate.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/apply.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(mkdir -p .workflows/.cache/), Bash(mv .workflows/.cache/), Bash(rm .workflows/.cache/), Bash(rm -rf .workflows/.cache/)
---

# Legacy Research Split

Act as **curator + interviewer**. Walk the user through decomposing migration-seeded broad research files (pre-inception epics) into topic-scoped themes.

## Purpose in the Workflow

Migration 038 seeded discovery-map items from existing research files, but those legacy files often contain multiple themes lumped under one broad name (e.g. `exploration.md` covering auth + caching + api-structure). Without intervention, automated analyses can't fire (they only operate on completed material) and the map stays anchored to a single in-progress broad file. This skill identifies qualifying legacy research files, presents their themes back to the user, and — with user approval — splits each broad file into topic-scoped files plus matching inception items.

### What This Skill Needs

- **Work unit** (required) — the epic to normalise. Passed by `continue-epic` Step 5.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next.

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

Initialise `applied_count = 0`, `abandoned_count = 0`, `errored_count = 0`.

```bash
node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs {work_unit}
```

Parse `qualifying_sources` from the JSON output.

#### If `qualifying_sources` is empty

→ Proceed to **Step 3**.

#### Otherwise

Set `remaining = qualifying_sources` (an ordered queue). Display the list.

> *Output the next fenced block as a code block:*

```
Qualifying source files (in-progress, migration-seeded):

@foreach(name in qualifying_sources)
  • {name}.md
@endforeach
```

→ Proceed to **Step 2**.

---

## Step 2: Per-Source Session Loop

> *Output the next fenced block as a code block:*

```
── Session Loop ─────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Iterating each qualifying source. Each iteration: identify
> themes, draft cache files, propose, edit-loop, apply.
```

Load **[dialog.md](references/dialog.md)** and follow its instructions as written. dialog.md drives the per-source iteration until `remaining` is empty, updating counters on each outcome.

→ Proceed to **Step 3**.

---

## Step 3: Conclude

> *Output the next fenced block as a code block:*

```
── Legacy Split Complete ────────────────────────
```

Evaluate the branches below in order — error reporting takes precedence over clean outcomes.

#### If `errored_count > 0`

> *Output the next fenced block as markdown (not a code block):*

```
> {errored_count} source file(s) aborted mid-apply; {applied_count}
> decomposed; {abandoned_count} skipped. See "Recovery from
> Interrupted Apply" below to clear stuck sentinels before the
> next /continue-epic.
```

→ Return to caller.

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

---

## Recovery from Interrupted Apply

apply.cjs sets `legacy_split_state: in-progress` on the source's inception item before any other mutation, then renames the source file and research item, then deletes the source inception item before theme creation. Once the file/research rename completes, detect.cjs naturally excludes the source on retry (the original file no longer exists and the original research item is renamed); the sentinel survival guards the narrower window before those renames complete.

If apply returns `ok: false`, the response's `recovery_hint` describes the manual cleanup the failing stage requires. Common cleanups:

```bash
# Clear a stuck sentinel
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.inception.{stuck_source} legacy_split_state

# Clean a stale cache directory after manual reconciliation
rm -rf .workflows/.cache/{work_unit}/legacy-split/{stuck_source}
```
