---
name: workflow-legacy-research-split
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/validate.cjs), Bash(node .claude/skills/workflow-legacy-research-split/scripts/apply.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs manifest), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs render), Bash(mkdir -p .workflows/.cache/), Bash(mv .workflows/.cache/), Bash(rm .workflows/.cache/), Bash(rm -rf .workflows/.cache/)
---

Act as **curator + interviewer**. Walk the user through decomposing broad research files — each holding multiple themes — into topic-scoped files plus matching discovery-map items.

**Parameters**:

- **Work unit** (required) — the epic to normalise. Passed by `workflow-continue-epic` Step 2.

---

## Step 1: List Qualifying Sources

> *Output the next fenced block as markdown (not a code block):*

```
# **`■ Legacy Research Split`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> This epic pre-dates the discovery phase. Migration-seeded broad research files are decomposed here into topic-scoped themes, user-guided per source.
```

> *Output the next fenced block as markdown (not a code block):*

```
**`□ List Qualifying Sources`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Scanning the epic's research files for migration-seeded broad sources that qualify for decomposition.
```

Initialise `applied_count = 0`, `abandoned_count = 0`, `errored_count = 0`.

```bash
node .claude/skills/workflow-legacy-research-split/scripts/detect.cjs {work_unit}
```

Parse `qualifying_sources` from the JSON output.

Fetch the scan's display — the interrupted splits a crashed apply left (detection excludes them, so they surface only here and need manual recovery), the sources whose names the split can't process, then the qualifying sources, each present only where the scan found its kind. The two advisories are informational — neither blocks the qualifying flow.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render legacy-split-display {work_unit} --variant sources
```

Emit the call's DISPLAY sections verbatim per their markers.

#### If `qualifying_sources` is empty

→ Proceed to **Step 3**.

#### Otherwise

Set `remaining = qualifying_sources` (an ordered queue).

→ Proceed to **Step 2**.

---

## Step 2: Per-Source Session Loop

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Session Loop`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Iterating each qualifying source. Each iteration: identify themes, draft cache files, propose, edit-loop, apply.
```

Load **[dialog.md](references/dialog.md)** and follow its instructions as written. dialog.md drives the per-source iteration until `remaining` is empty, updating counters on each outcome.

→ On return, proceed to **Step 3**.

---

## Step 3: Conclude

Fetch the split's conclusion from the session's tallies and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render legacy-split-display --variant complete --applied {applied_count} --abandoned {abandoned_count} --errored {errored_count}
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
