# Session Loop

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Process each name in `qualifying_sources` from **[detect-trigger.md](detect-trigger.md)** — one source file per iteration.

## A. Iterate

#### If `qualifying_sources` is empty

→ Return to caller.

#### Otherwise

Pop the next name. Set `current_source = name`.

→ Proceed to **B. Read Source and Map**.

## B. Read Source and Map

> *Output the next fenced block as a code block:*

```
── Processing Source ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Working on {current_source}.md.
```

Read `.workflows/{work_unit}/research/{current_source}.md` end-to-end.

Re-run discovery so the map reflects items written by any prior iteration in this session:

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
```

From the discovery output, set `existing_names = [item.name for item in discovery_map]`. Dismissed-list collisions are handled downstream by topic-name-validation.

→ Proceed to **C. Identify Themes**.

## C. Identify Themes

> *Output the next fenced block as a code block:*

```
·· Identify Themes ······························
```

Read the source file in full. Count its paragraphs to set `source_paragraph_count` — propose-candidates C uses this to verify the theme partition. A paragraph is a blank-line-separated block, with two atomic-unit exceptions: a fenced code block (` ``` … ``` `) counts as ONE paragraph regardless of internal blank lines, and a list (consecutive `-`/`*`/`1.` lines, possibly with blank-line gaps between items) counts as ONE paragraph. Nested atomic units (e.g., a code block inside a list item) are absorbed into the outer atomic unit — outer wins. Theme content allocation must respect these atomic units so paragraph counts are consistent between source and themes.

Extract every distinct theme. Group sub-themes into coherent domains (anti-pattern: one theme per system component; a coherent domain becomes one topic). Prefer fewer, coarser topics — see **[research-analysis.md](../../workflow-shared/references/research-analysis.md)** Section B for the independence test and anti-patterns.

**Content allocation is mandatory.** Walk every paragraph of the source file and assign it to exactly one theme. Every paragraph must land somewhere — losing content is a failure mode. Duplication is also wrong (a paragraph belongs in one place). The result is a partition of the source's prose, and `sum(theme.paragraph_count) == source_paragraph_count` by construction.

For each theme, propose:

- `kebab_name`
- `summary` — one line
- `description` — a paragraph or two synthesised from the source
- `routing` — `discussion` (well-explored, ready for discussion) or `research` (under-explored, needs more research)
- `content` — the verbatim source paragraphs assigned to this theme (no summarisation, no rewording — these paragraphs will become the body of the new or merged research file)

Classify against `existing_names` and `current_source`:

- **`stays`** — `kebab_name` equals `current_source`
- **`merges`** — `kebab_name` matches another entry in `existing_names`
- **`creates`** — `kebab_name` matches nothing on the map

→ Proceed to **D. Propose to User**.

## D. Propose to User

→ Load **[propose-candidates.md](propose-candidates.md)** and follow its instructions as written. On return, either the user has approved a plan (stored as `approved_creates`, `approved_merges`, `approved_stays`) or abandoned this source (`abandoned = true`).

#### If user abandoned

Increment `abandoned_count`.

> *Output the next fenced block as a code block:*

```
Skipping {current_source}. Source file and manifest unchanged.
```

→ Return to **A. Iterate**.

#### Otherwise

→ Proceed to **E. Apply Split**.

## E. Apply Split

→ Load **[apply-split.md](apply-split.md)** and follow its instructions as written.

The boundary between "success" and "errored" is whether the reference reached and completed its **E. Commit** (or its E "If `written_files` is empty" sibling). A non-fatal warning along the way — for example a KB-remove failure in apply-split D, which the spec explicitly tells you to surface but not abort on — counts as success because the commit still ran.

#### If apply-split reached and completed its E. Commit

Increment `applied_count`.

→ Return to **A. Iterate**.

#### If apply-split aborted before reaching its E. Commit

A manifest write failed, the git commit hook rejected, or another step did not complete. Increment `errored_count`. Do NOT increment `applied_count` — the source is left in a partial-apply state with `legacy_split_state: in-progress`. Surface the error to the user and point them at the Recovery From Interrupted Apply section of the parent SKILL.md (`../SKILL.md`).

→ Return to **A. Iterate**.
