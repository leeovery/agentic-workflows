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

1. Render a new file at `.workflows/{work_unit}/research/{c.kebab_name}.md` from **[template.md](../../workflow-research-process/references/template.md)**. Title-case `c.kebab_name` for `{Title}`. Paste `c.content` verbatim below the "Starting Point" section — no summarisation, no rewording.

→ Proceed to **B. Append to Merge Targets**.

## B. Append to Merge Targets

For each `m` in `approved_merges`, append `m.content` to `.workflows/{work_unit}/research/{m.target_name}.md` with a `---` separator above it. No dedup.

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

One theme kept the source name. Source file, research item, and inception item are all unchanged.

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
