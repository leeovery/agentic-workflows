# Apply Split

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Write the approved split to disk and manifest. Inputs: `approved_creates`, `approved_merges`, `approved_stays`, `current_source`, `work_unit`.

All manifest writes here are designed to be **idempotent**: re-running this reference after a partial-apply interruption must not error or corrupt state. Init-phase calls are gated with `exists` prechecks; `set` calls are inherently idempotent (last write wins). Initialise `written_files = []` to track paths for the commit.

## A. Create New Research Files

> *Output the next fenced block as a code block:*

```
·· Create Files ·································
```

Before any writes, mark the source's inception item as in-flight. detect-trigger reads `legacy_split_state` to exclude the source from re-qualification on retry:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{current_source} legacy_split_state in-progress
```

For each `c` in `approved_creates`:

1. Render `.workflows/{work_unit}/research/{c.kebab_name}.md` from **[template.md](../../workflow-research-process/references/template.md)**:
   - `{Title}` — title-case `c.kebab_name`
   - "Brief description" line — replace with `c.summary`
   - "Starting Point" bullets — replace with a single line: `Material extracted from legacy research file {current_source}.md via legacy-research-split.`
   - Below the `---` separator — paste `c.content` verbatim (the paragraphs assigned to this theme in session-loop C). No summarisation, no rewording.

2. Append the path to `written_files`.

→ Proceed to **B. Append to Merge Targets**.

## B. Append to Merge Targets

For each `m` in `approved_merges`:

Check whether the research item already exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.research items.{m.target_name}
```

**If `false`:**

Init the research item so the merge target has a tracked entry:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{m.target_name}
```

**If `true`:**

Leave the existing item in place.

Then check whether the on-disk file exists. The path is `.workflows/{work_unit}/research/{m.target_name}.md`.

**If the file does not exist:**

Render it from **[template.md](../../workflow-research-process/references/template.md)** with `{Title}` = title-cased `m.target_name`, "Brief description" = `Merge target for legacy-split content from {current_source}.md.`, and the same starting-point line as **A**.

**Otherwise:**

Leave existing content in place.

Then append `m.content` to the file, preceded by a `---` separator. No dedup. Append the path to `written_files`.

→ Proceed to **C. Manifest Writes — Creates**.

## C. Manifest Writes — Creates

For each `c` in `approved_creates`:

**If `c.pull_dismissed` is true:**

Clear the dismissed entry first (the pull is a no-op if the name has already been pulled):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.inception dismissed "{c.kebab_name}"
```

Check whether the research item already exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.research items.{c.kebab_name}
```

**If `false`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{c.kebab_name}
```

**If `true`:**

Leave the existing item in place — a partial-apply re-entry has already initialised it.

Then check whether the inception item already exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.inception items.{c.kebab_name}
```

**If `false`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{c.kebab_name}
```

**If `true`:**

Leave the existing item in place.

Stamp the inception item's fields (idempotent — `set` is last-write-wins):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} routing {c.routing}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} summary "{c.summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} description "{c.description}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} source "legacy-split:{current_source}"
```

The new research item lands `in-progress` (init-phase default). The `legacy-split:{source}` source distinguishes these from native inception items.

→ Proceed to **D. Supersede Source If No `stays`**.

## D. Supersede Source If No `stays`

#### If `approved_stays` is empty

No theme keeps the source name. Set the source's research item to `superseded` (idempotent):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research.{current_source} status superseded
```

Then check whether the source's inception entry still exists (it won't on re-entry after a partial apply):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.inception items.{current_source}
```

**If `true`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.inception items.{current_source}
```

**If `false`:**

Already removed.

Then drop the source's chunks from the KB (no-op if nothing was indexed):

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {work_unit} --phase research --topic {current_source}
```

If the KB remove fails (KB not initialised, schema mismatch, etc.), surface the error to the user but continue to E — the manifest writes above are authoritative, and stale KB chunks can be reconciled later via `knowledge reindex`. Do not abort: leaving the apply mid-flight would strand the source with `legacy_split_state: in-progress`.

The source file itself stays on disk as historical record.

→ Proceed to **E. Commit**.

#### Otherwise

One theme kept the source name. The source's research item and inception entry remain, but the inception item's metadata must be updated to reflect the kept theme's summary/description — otherwise the migration-seeded item retains null summary/description and Step 6 (summary backfill) in continue-epic would re-prompt the user to fill them in for a topic they just curated. Write them now (idempotent — `set` is last-write-wins):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{current_source} summary "{approved_stays[0].summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{current_source} description "{approved_stays[0].description}"
```

Then, if any content moved out (via creates or merges), the source file must be rewritten to contain only the stays theme's content — otherwise the moved paragraphs would duplicate between the source and the new files.

**If `approved_creates` and `approved_merges` are both empty:**

Source file untouched — nothing moved out.

→ Proceed to **E. Commit**.

**Otherwise:**

Rewrite `.workflows/{work_unit}/research/{current_source}.md` from **[template.md](../../workflow-research-process/references/template.md)** with `{Title}` = title-cased `current_source`, "Brief description" = `approved_stays[0].summary`, the same starting-point line as **A**, and `approved_stays[0].content` verbatim below the separator. Append the path to `written_files`.

→ Proceed to **E. Commit**.

## E. Commit

#### If `written_files` is empty

No files were written, but the manifest WAS changed in D (summary/description on the source's inception item, plus the sentinel set in A). Transition the sentinel from `in-progress` to `applied`, then commit just the manifest so the working tree isn't left dirty:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{current_source} legacy_split_state applied
git add -- .workflows/{work_unit}/manifest.json
git commit -m "inception({work_unit}): legacy-split {current_source} (stays-only)"
```

→ Return to caller.

#### Otherwise

Stage only the paths this iteration touched, plus the manifest. Avoid `git add` on the whole research directory — unrelated user edits in sibling files must not be swept into the legacy-split commit.

```bash
git add -- .workflows/{work_unit}/manifest.json
@foreach(path in written_files)
git add -- {path}
@endforeach
git commit -m "inception({work_unit}): legacy-split {current_source} into {N} topic(s)"
```

`{N}` = `approved_creates.length + approved_merges.length + approved_stays.length`.

After the commit, transition the source's `legacy_split_state` from `in-progress` to `applied`. In the supersede branch (D's `If approved_stays is empty`) the inception item was deleted, so check first:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.inception items.{current_source}
```

**If `true`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{current_source} legacy_split_state applied
```

→ Return to caller.

**If `false`:**

No-op — the supersede branch already removed the item.

→ Return to caller.
