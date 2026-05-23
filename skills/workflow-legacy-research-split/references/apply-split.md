# Apply Split

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Write the user-approved split to disk and manifest. Inputs from **[propose-candidates.md](propose-candidates.md)**: `approved_creates`, `approved_merges`, `approved_stays`, `current_source`, `work_unit`.

## A. Create New Research Files

> *Output the next fenced block as a code block:*

```
·· Create Files ································
```

For each entry `c` in `approved_creates`:

1. Build the new research file path: `.workflows/{work_unit}/research/{c.kebab_name}.md`.

2. Render using **[template.md](../../workflow-research-process/references/template.md)** — fill `{Title}` with title-cased `c.kebab_name`. The body's "Starting Point" section can be brief; below it, paste `c.content` verbatim from the source (no summarisation, no rewording).

3. Write the file.

→ Proceed to **B. Append to Merge Targets**.

## B. Append to Merge Targets

For each entry `m` in `approved_merges`:

1. Append `m.content` verbatim to `.workflows/{work_unit}/research/{m.target_name}.md`. Add a separator (`---`) above the appended block. No dedup — duplication is acceptable.

→ Proceed to **C. Manifest Writes — Creates**.

## C. Manifest Writes — Creates

For each entry `c` in `approved_creates`:

If `c.pull_dismissed` is true, pull the name from the dismissed list first:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.inception dismissed "{c.kebab_name}"
```

Then init research + inception items:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{c.kebab_name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{c.kebab_name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} routing {c.routing}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} summary "{c.summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} description "{c.description}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{c.kebab_name} source "legacy-split:{current_source}"
```

The new research item lands `in-progress` (init-phase default). The inception item is provenance-tagged so downstream auto-routing can distinguish legacy-derived topics.

→ Proceed to **D. Supersede Source If No `stays`**.

## D. Supersede Source If No `stays`

#### If `approved_stays` is empty

The source file represents no theme directly — every theme moved to a new file or merged elsewhere. The source's inception and research items become stale.

1. Set source research status to `superseded`:

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research.{current_source} status superseded
   ```

2. Remove the source's inception item entirely:

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.inception items.{current_source}
   ```

3. Remove from knowledge base (source file may have been previously indexed):

   ```bash
   node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {work_unit} --phase research --topic {current_source}
   ```

The source file itself stays on disk untouched — it is historical record; nothing reads it after the supersede.

→ Proceed to **E. Commit**.

#### Otherwise

One theme kept the source name. Source file, research item, and inception item are all unchanged.

→ Proceed to **E. Commit**.

## E. Commit

Single commit covering this source's decomposition:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/research/
git commit -m "epic({work_unit}): legacy-split {current_source} into {N} topic(s)"
```

Where `{N}` = `approved_creates.length + approved_merges.length + approved_stays.length`.

→ Return to caller.
