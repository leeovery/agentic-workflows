---
name: workflow-legacy-research-split
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/validate.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/apply.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(mkdir -p .workflows/.cache/), Bash(mv .workflows/.cache/), Bash(rm .workflows/.cache/), Bash(rm -rf .workflows/.cache/)
---

# Legacy Research Split

Act as **curator + interviewer**. Walk the user through decomposing broad research files — each holding multiple themes — into topic-scoped files plus matching discovery-map items.

### What This Skill Needs

- **Work unit** (required) — the epic to normalise. Passed by `workflow-continue-epic` Step 5.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- Don't invent stops. Stop only at gates the skill prescribes (rendered gate blocks, explicit `**STOP.**` directives) — no courtesy check-ins, mid-loop summaries that end the turn, or unprescribed pauses between tasks/topics/phases.
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
> This epic pre-dates the discovery phase. Migration-seeded broad
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
> Interrupted Apply" below to clear stuck sentinels before you
> reopen the epic via /workflow-start.
```

→ Return to caller.

#### If `applied_count == 0` and `abandoned_count == 0`

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
> next time you open the epic via /workflow-start.
```

→ Return to caller.

#### If `applied_count == 0` and `abandoned_count > 0`

> *Output the next fenced block as markdown (not a code block):*

```
> No source files decomposed — every qualifying file was skipped.
> They remain on the map and can be revisited next time you open
> the epic via /workflow-start.
```

→ Return to caller.

---

## Recovery from Interrupted Apply

If `apply.cjs` returns `ok: false`, the response's `recovery_hint` names the manual cleanup the failing stage requires. Common cleanups:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery.{stuck_source} legacy_split_state
rm -rf .workflows/.cache/{work_unit}/legacy-split/{stuck_source}
```
