---
name: workflow-legacy-research-split
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/validate.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/apply.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs manifest), Bash(mkdir -p .workflows/.cache/), Bash(mv .workflows/.cache/), Bash(rm .workflows/.cache/), Bash(rm -rf .workflows/.cache/)
---

Act as **curator + interviewer**. Walk the user through decomposing broad research files — each holding multiple themes — into topic-scoped files plus matching discovery-map items.

**Parameters**:

- **Work unit** (required) — the epic to normalise. Passed by `workflow-continue-epic` Step 5.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

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

> *Output the next fenced block as markdown (not a code block):*

```
> Scanning the epic's research files for migration-seeded broad
> sources that qualify for decomposition.
```

Initialise `applied_count = 0`, `abandoned_count = 0`, `errored_count = 0`.

```bash
node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs {work_unit}
```

Parse `qualifying_sources`, `unsplittable`, and `stranded_sentinels` from the JSON output.

Surface detect's advisories before routing on the qualifying set. Both are informational — neither blocks the qualifying flow.

**If `stranded_sentinels` is non-empty:** a prior apply crashed mid-split, leaving these items marked in-progress. Detection excludes them, so they surface only here and need manual recovery.

> *Output the next fenced block as a code block:*

```
  ⚑ Interrupted split(s) detected — a prior apply crashed mid-flight.
    Clear each, then reopen the epic via /workflow-start to retry:

@foreach(name in stranded_sentinels)
    • {name}
@endforeach

    Per-item recovery is under "Recovery from Interrupted Apply"
    at the end of this skill.
```

**If `unsplittable` is non-empty:** one or more migration-seeded sources carry names the split can't process — the engine rejects dots and slashes in map paths.

> *Output the next fenced block as a code block:*

```
  ⚑ Unsplittable source(s) — rename each on the discovery map to a
    kebab name, then reopen the epic to split:

@foreach(src in unsplittable)
    • {src.name} — {src.reason}
@endforeach
```

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

→ On return, proceed to **Step 3**.

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

An interrupted split leaves a `legacy_split_state` sentinel on the source's discovery item. It surfaces two ways:

- **`apply.cjs` returned `ok: false`** — the response's `recovery_hint` names the cleanup the failing stage requires.
- **Step 1 flagged a stranded sentinel** — a prior apply's process died between the sentinel write and the source-item delete. detect reports it under `stranded_sentinels`.

Clear the sentinel and drop the cache:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discovery.{stuck_source} legacy_split_state
rm -rf .workflows/.cache/{work_unit}/legacy-split/{stuck_source}
```

If the crash also renamed the source file to `{stuck_source}-superseded-{datetime}.md` and marked its research item `superseded`, restore those (or keep the superseded copy and re-add the discovery item) before re-attempting the split.
