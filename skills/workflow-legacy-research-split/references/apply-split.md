# Apply Split

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Write the approved split to disk and manifest. Inputs: `approved_creates`, `approved_merges`, `approved_stays`, `current_source`, `work_unit`.

## A. Create New Research Files

> *Output the next fenced block as a code block:*

```
·· Create Files ·································
```

For each `c` in `approved_creates`:

1. Render a new file at `.workflows/{work_unit}/research/{c.kebab_name}.md` from **[template.md](../../workflow-research-process/references/template.md)**.
   - `{Title}` — title-case `c.kebab_name`
   - "Brief description" line — replace with `c.summary`
   - "Starting Point" bullets — replace with a single line: `Material extracted from legacy research file {current_source}.md via legacy-research-split.`
   - Below the `---` separator — paste `c.content` verbatim (the paragraphs assigned to this theme in session-loop C). No summarisation, no rewording.

→ Proceed to **B. Append to Merge Targets**.

## B. Append to Merge Targets

For each `m` in `approved_merges`:

1. If `phases.research.items.{m.target_name}` does not exist on the manifest, init it (the target is on the inception map but research hasn't started yet):

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{m.target_name}
   ```

2. If `.workflows/{work_unit}/research/{m.target_name}.md` does not exist on disk, render it from **[template.md](../../workflow-research-process/references/template.md)** using the same field substitutions as **A** (with `m.target_name` as the title and a starting-point line noting the legacy-split origin). Otherwise, leave existing content in place.

3. Append `m.content` verbatim to the file, preceded by a `---` separator. No dedup.

→ Proceed to **C. Manifest Writes — Creates**.

## C. Manifest Writes — Creates

For each `c` in `approved_creates`:

If `c.pull_dismissed` is true, the name had a dismissed entry that validation pulled — clear it first:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.inception dismissed "{c.kebab_name}"
```

Initialise research + inception items and stamp provenance:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{c.kebab_name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{c.kebab_name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} routing {c.routing}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} summary "{c.summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} description "{c.description}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} source "legacy-split:{current_source}"
```

The new research item lands `in-progress` (init-phase default). The `legacy-split:{source}` source distinguishes these from native inception items.

→ Proceed to **D. Supersede Source If No `stays`**.

## D. Supersede Source If No `stays`

#### If `approved_stays` is empty

No theme keeps the source name, so the source's research and inception items are now stale. Supersede the research item, remove the inception entry, and drop the source's chunks from the KB:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research.{current_source} status superseded
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.inception items.{current_source}
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {work_unit} --phase research --topic {current_source}
```

The source file itself stays on disk as historical record.

→ Proceed to **E. Commit**.

#### Otherwise

One theme kept the source name. The source's research and inception items stay as they are, but if any content moved out (via creates or merges), the source file must be rewritten to contain only the stays theme's content — otherwise the moved paragraphs would duplicate between the source and the new files.

**If `approved_creates` and `approved_merges` are both empty:** source file untouched (nothing moved out).

**Otherwise:** rewrite `.workflows/{work_unit}/research/{current_source}.md` from **[template.md](../../workflow-research-process/references/template.md)** using the same field substitutions as **A** — title-case `current_source` for `{Title}`, `approved_stays[0].summary` for the brief description line, the legacy-split provenance line, and `approved_stays[0].content` verbatim below the separator. This replaces the legacy broad content with only what the user kept under this name.

→ Proceed to **E. Commit**.

## E. Commit

#### If `approved_creates` and `approved_merges` are both empty

Only `stays` was approved — source is untouched and nothing was written. No commit.

→ Return to caller.

#### Otherwise

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/research/
git commit -m "epic({work_unit}): legacy-split {current_source} into {N} topic(s)"
```

`{N}` = `approved_creates.length + approved_merges.length + approved_stays.length`.

→ Return to caller.
