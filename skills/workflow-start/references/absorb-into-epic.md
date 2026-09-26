# Absorb Feature into Epic

*Reference for **[manage-work-unit](manage-work-unit.md)***

---

Merge a feature's discussion into an existing epic as a new topic, then remove the feature entirely. This reference owns the judgment — which epic, the topic name, the user's confirmation; the engine transaction (`workunit absorb`) owns the mechanical tail.

## A. Select Target Epic

> *Output the next fenced block as markdown (not a code block):*

```
> This will move the feature's discussion, research, experiments, seed, and imports into the selected epic as a new topic and delete the feature work unit. Git history serves as provenance.
```

Fetch and emit the `MENU: absorb target` section verbatim per its marker (its numbering follows the DATA `available_epics` order):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render absorb-target {selected.name}
```

**STOP.** Wait for user response.

#### If user chose `b/back`

→ Return to caller.

#### If user chose a number

Resolve the number against `available_epics` and store the selected epic as `target_epic`. The topic takes the feature's own name: set `topic` = `{selected.name}`.

→ Proceed to **B. Collision Check**.

---

## B. Collision Check

Check whether the name is taken in the target epic — as a discussion topic, an experiment series, or a research topic:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {target_epic}.discussion.{topic}
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {target_epic}.experiment.{topic}
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {target_epic}.research.{topic}
```

#### If any is `true`

Derive a different kebab-case name from the feature's name and its discussion's subject, set `topic` to it, and re-check:

→ Return to **B. Collision Check**.

#### If all are `false`

→ Proceed to **C. Confirm**.

---

## C. Confirm

Fetch the summary — every fact is the feature's own manifest state, read by the surface — and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render absorb-summary {selected.name} --into {target_epic} --topic {topic}
```

Fetch the gate and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render absorb-confirm-gate {selected.name}
```

**STOP.** Wait for user response.

#### If user chose `n/no`

→ Return to caller.

#### If user chose `y/yes`

→ Proceed to **D. Absorb**.

---

## D. Absorb

One engine transaction moves the discussion (and any research, experiment series, imports, and seeds) into the epic, mirrors each item's status, registers the topic on the discovery map (`--backfill` — the next `/workflow-continue-epic` entry routes to `summary-backfill.md` so the user can review derived values), syncs the knowledge base (experiments never enter it), deletes the feature, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit absorb {selected.name} --into {target_epic} --topic {topic}
```

The JSON response reports what moved (`discussion`, `research`, `experiment`, `imports`, `seeds` — the research lands at the topic name), `renamed_imports` (the imports a name collision renamed, empty when none did), `routing`, `committed`, and `warnings`.

#### If the command failed

The refusal names the blocking condition; nothing was touched.

**If the error ends "— pick a different name"** (a name collision, item- or file-form):

Derive a different kebab-case name from the feature's name and its discussion's subject, set `topic` to it, and re-check it:

→ Return to **B. Collision Check**.

**Otherwise:**

Relay the error.

→ Return to caller.

#### Otherwise

The command succeeded.

→ Proceed to **E. Post-Absorption**.

---

## E. Post-Absorption

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` summary, each verbatim per its marker. `--moved` lists whichever of `research`, `seeds`, `imports` the absorb response reported non-empty (comma-separated; omit the flag when none moved), `--experiments` carries the count of top-level ids (no dot) in the response's `experiment.experiments` when a series moved (omit otherwise — a split is worked inside its parent, so subs never count), `--renamed` carries `{renamed}`, the response's `renamed_imports` joined as comma-separated `{from}:{to}` pairs — the imports a name collision renamed, whose links the absorb rewrote in the documents it moved (omit the flag when the list is empty) — and `--warn` rides when the response's `warnings` is non-empty:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render absorb-receipt {target_epic} --topic {topic} [--moved {moved}] [--experiments {N}] [--renamed {renamed}] [--warn]
```

Fetch the continuation and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render absorb-continuation {target_epic} --feature {selected.name}
```

**STOP.** Wait for user response.

#### If user chose `c/continue`

Invoke the `/workflow-continue-epic` skill.

**STOP.** Do not proceed — terminal condition.

#### If user chose `b/back`

→ Return to caller.
