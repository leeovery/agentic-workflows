# Session Loop

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Drive the per-source iteration: read source, identify themes, early sanity gate, draft cache, propose, edit, validate, apply. Edit operations live in their own lettered sections (K–P) dispatched from G.

## A. Iterate

#### If `remaining` is empty

→ Return to caller.

#### Otherwise

Pop the next name from `remaining`. Set `current_source = name`.

> *Output the next fenced block as a code block:*

```
·· Processing {current_source} ··················
```

> *Output the next fenced block as markdown (not a code block):*

```
> Working on {current_source}.md.
```

→ Proceed to **B. Read Source**.

## B. Read Source

Read `.workflows/{work_unit}/research/{current_source}.md` end-to-end. Hold the content in working memory — later sections reference it.

→ Proceed to **C. List Candidate Themes**.

## C. List Candidate Themes

apply.cjs renames the source to `{source}-superseded-{datetime}.md` when the plan is applied. No content survives in the original location. **Every meaningful piece of the source must land in a candidate theme** — there is no "leave it in place" option. Material not transcribed into a theme is lost.

Identify themes from the source's natural structure: its top-level headings, the distinct subjects it discusses, the seams where focus shifts. A long, multi-subject file legitimately produces many themes; a short, single-subject file is one theme. Small fragments that don't justify a standalone theme get merged into the most closely related one — never dropped.

→ Load **[topic-granularity.md](../../workflow-shared/references/topic-granularity.md)**.

Legacy-decomposition specifics:

- **Semantic allocation; rewriting for flow allowed.** Each theme's cache file may rewrite source paragraphs for flow, may overlap mildly with siblings where the source itself overlaps, and need not be a strict partition of the source.

- **Name reuse is fine** for the source's own name (e.g. an `auth` source decomposed into one `auth` theme, or into `auth` + `caching`). The source is renamed to `{source}-superseded-{datetime}.md` before themes are created, so the original name is always available for reuse.

- **Avoid collisions with other active topics.** Theme `kebab_name` must not match any *other* existing discovery item on the map (besides the source itself). `validate.cjs` enforces this — if a candidate name clashes with an existing topic, pick a different name. The current map is in the discovery output already in context from `workflow-continue-epic` Step 1; consult it before naming.

- **Dismissed names are allowed.** If a candidate name matches an entry on the work unit's `dismissed[]` list (topics the user previously removed from the map), that's fine — `apply.cjs` pulls the name from `dismissed` before re-adding. User-driven legacy-split bypasses the dismissed gate (which only blocks automatic re-adds).

- **Single-theme split is valid.** Even when the source contains a single coherent theme, the split still runs. The source file is renamed to `-superseded-`, the new file is created with the (possibly re-flowed) content, and the discovery item gets full metadata. This normalises legacy items without forcing artificial decomposition.

For each candidate theme, build a tentative entry:

- `kebab_name` — short, kebab-cased
- `summary` — one line
- `description` — paragraph or two synthesised from the source

Hold these in working memory. Do NOT write any cache files yet.

→ Proceed to **D. Confirm Theme List**.

## D. Confirm Theme List

Display the candidate theme list. This is an early sanity gate — catch obvious over- or under-splitting BEFORE drafting any cache files.

> *Output the next fenced block as a code block:*

```
Candidate themes for {current_source}.md:

@foreach(theme in candidates)
{N}. {theme.kebab_name}
   └─ {theme.summary}
@endforeach
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Proceed to draft cache files
- **Redirect** — Adjust the theme list (rename, merge two, split one, add, remove)
- **`a`/`abandon`** — Skip this source file
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **E. Draft Cache Files**.

#### If redirect

Apply the user's adjustment in working memory (no files written yet). Supported in-memory operations:

- **Rename** — update `kebab_name` on the named theme
- **Merge two** — combine two candidate themes into one
- **Split one** — replace one candidate theme with two
- **Add** — insert a new candidate
- **Remove** — drop a candidate

→ Return to **D. Confirm Theme List**.

#### If `abandon`

→ Proceed to **J. Abandon Source**.

## E. Draft Cache Files

Create the cache directory:

```bash
mkdir -p .workflows/.cache/{work_unit}/legacy-split/{current_source}
```

For each theme in the candidate list, write its body to:

```
.workflows/.cache/{work_unit}/legacy-split/{current_source}/{theme.kebab_name}.md
```

The cache file **IS** the new research file body — it becomes the content of `.workflows/{work_unit}/research/{theme.kebab_name}.md` after apply. It is **not** a summary. The substance of the source must transfer.

**Extraction discipline:**

- **Verbatim by default.** Move the source's content assigned to this theme into the cache file as the source has it. Don't paraphrase, don't summarise, don't condense. The user's existing prose is the substance — preserve it.

- **Rewrite for flow only where helpful.** Light editing is OK to make the extracted content self-contained when it would otherwise leave the reader stranded: fix dangling references to other themes ("as discussed above" when "above" is now in a different file), tighten a transition that no longer flows, split a long paragraph that mixes themes. Don't rewrite for style. When in doubt, copy verbatim.

- **Don't lose content.** The source file is replaced by apply — anything not transcribed into a theme cache file is gone. Walk the source top to bottom and confirm every paragraph, list, code block, and table is accounted for in at least one theme.

- **Mild duplication is acceptable** where the source itself genuinely overlaps — e.g. a paragraph discussing a trade-off relevant to both `auth` and `caching` themes can appear in both cache files. Don't manufacture duplication; mirror what the source does.

- **Substantive bodies.** Each cache file is the new research file's body. Its size is whatever the source had on that theme. If a cache file is sparse when its theme spans several sections of the source, re-read and finish the extraction.

- **Long sources need careful walking.** Work theme-by-theme: pick one theme, scan the source end-to-end for everything that belongs to it, transcribe in source order, then move to the next theme. Don't try to allocate the whole source in one pass — interleaved material is easy to miss.

- **No empty cache files.** `validate.cjs` rejects files that are blank or whitespace-only.

Build `plan.json` from the candidate list and write to:

```
.workflows/.cache/{work_unit}/legacy-split/{current_source}/plan.json
```

Schema:

```json
{
  "themes": [
    {
      "kebab_name":  "auth",
      "summary":     "one-line summary",
      "description": "paragraph or two synthesised from the source"
    }
  ]
}
```

The `description` field gives the discovery map context; the cache file gives the new research file's full body. Both are required.

→ Proceed to **F. Propose Plan**.

## F. Propose Plan

> *Output the next fenced block as markdown (not a code block):*

```
> Cache files drafted. They're first-class artifacts — you can
> `cat` or open them in your editor between renders, and your
> edits will land on the next display.
```

For each theme in `plan.json`, read the cache file, count paragraphs (blank-line-separated blocks), and take the first ~60 chars of the first paragraph as `content_preview`.

> *Output the next fenced block as a code block:*

```
Plan for {current_source}.md:

@foreach(theme in plan.themes)
{N}. {theme.kebab_name}
   └─ Summary: {theme.summary}
   └─ Content: {paragraph_count} para(s) — "{content_preview}..."
   └─ Cache: .workflows/.cache/{work_unit}/legacy-split/{current_source}/{theme.kebab_name}.md
@endforeach

Source file will be renamed to {current_source}-superseded-{datetime}.md.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Apply this plan
- **Edit** — Modify cache files or plan.json (rename, merge, split, add, remove). To rewrite a draft, edit the cache file directly between renders.
- **`a`/`abandon`** — Skip this source file
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **H. Validate**.

#### If edit

→ Proceed to **G. Apply Edit**.

#### If `abandon`

→ Proceed to **J. Abandon Source**.

## G. Apply Edit

Dispatch to the matching operation based on the user's request. Every operation returns to **F. Propose Plan** for re-render.

#### If the edit is a rename

→ Proceed to **K. Rename a Theme**.

#### If the edit merges two themes

→ Proceed to **M. Merge Two Themes**.

#### If the edit splits one theme

→ Proceed to **N. Split One Theme**.

#### If the edit adds a theme

→ Proceed to **O. Add a Theme**.

#### If the edit removes a theme

→ Proceed to **P. Remove a Theme**.

## H. Validate

```bash
node .claude/skills/workflow-legacy-research-split/scripts/validate.cjs {work_unit} {current_source}
```

Parse the JSON output.

#### If `ok` is true

→ Proceed to **I. Apply**.

#### If `ok` is false

> *Output the next fenced block as a code block:*

```
Validation failed for {current_source}:

@foreach(err in errors)
  • {err}
@endforeach
```

> *Output the next fenced block as markdown (not a code block):*

```
> Fix the cache files or plan.json, then re-render.
```

→ Return to **F. Propose Plan**.

## I. Apply

```bash
node .claude/skills/workflow-legacy-research-split/scripts/apply.cjs {work_unit} {current_source}
```

Parse the JSON output.

#### If `ok` is true

Increment `applied_count`.

> *Output the next fenced block as a code block:*

```
Applied {current_source}: {applied.themes} new file(s).
```

If the response includes `kb_warnings`, render them — KB cleanup is best-effort and the user should know the index needs reconciling:

> *Output the next fenced block as markdown (not a code block):*

```
> ⚑ Knowledge-base cleanup reported warnings:
@foreach(w in kb_warnings)
> - {w}
@endforeach
>
> Consider running `knowledge rebuild` after the session to reconcile.
```

→ Return to **A. Iterate**.

#### If `ok` is false

Increment `errored_count`.

> *Output the next fenced block as a code block:*

```
Apply failed for {current_source} at stage "{stage}":
  {error}

Recovery: {recovery_hint}
```

→ Return to **A. Iterate**.

## J. Abandon Source

Remove the cache subdirectory (if it exists):

```bash
rm -rf .workflows/.cache/{work_unit}/legacy-split/{current_source}
```

Increment `abandoned_count`.

> *Output the next fenced block as a code block:*

```
Skipping {current_source}. Source file and manifest unchanged.
```

→ Return to **A. Iterate**.

## K. Rename a Theme

User specifies `old_name` and `new_name`.

1. Read `plan.json`. Locate the theme with `kebab_name == old_name`. Update its `kebab_name` to `new_name`.
2. Write `plan.json`.
3. ```bash
   mv .workflows/.cache/{work_unit}/legacy-split/{current_source}/{old_name}.md .workflows/.cache/{work_unit}/legacy-split/{current_source}/{new_name}.md
   ```

→ Return to **F. Propose Plan**.

## M. Merge Two Themes

User specifies `theme_a`, `theme_b`, and `surviving_name` (often equal to `theme_a` or `theme_b`).

1. Read both cache files into memory.
2. Concatenate the bodies (with a blank line between) and write the result to `.workflows/.cache/{work_unit}/legacy-split/{current_source}/{surviving_name}.md`.
3. Delete the originals that didn't survive:
   - If `surviving_name == theme_a`: `rm .workflows/.cache/{work_unit}/legacy-split/{current_source}/{theme_b}.md`
   - If `surviving_name == theme_b`: `rm .workflows/.cache/{work_unit}/legacy-split/{current_source}/{theme_a}.md`
   - Otherwise (new name): `rm` both originals.
4. Read `plan.json`. Remove both original theme entries. Add a new entry with `kebab_name = surviving_name`, summary/description merged or rewritten as the user directs.
5. Write `plan.json`.

→ Return to **F. Propose Plan**.

## N. Split One Theme

User specifies `original_name`, `name_a`, `name_b`, and (in their message) what content goes where.

1. Read the original cache file. Allocate paragraphs to `name_a` and `name_b` per the user's instruction.
2. Write two new cache files:
   ```
   .workflows/.cache/{work_unit}/legacy-split/{current_source}/{name_a}.md
   .workflows/.cache/{work_unit}/legacy-split/{current_source}/{name_b}.md
   ```
3. Remove the original cache file:
   ```bash
   rm .workflows/.cache/{work_unit}/legacy-split/{current_source}/{original_name}.md
   ```
4. Read `plan.json`. Remove the original theme entry. Add two new entries (`name_a`, `name_b`) with appropriate summary/description. If any field is ambiguous, ask one clarifying question before proceeding — this is conversational flow, not a structured STOP.
5. Write `plan.json`.

→ Return to **F. Propose Plan**.

## O. Add a Theme

User specifies `kebab_name`, summary, description, and the content for the new cache file.

1. Read `plan.json`. Add the new theme entry.
2. Write `plan.json`.
3. Write the cache file at `.workflows/.cache/{work_unit}/legacy-split/{current_source}/{kebab_name}.md`.

→ Return to **F. Propose Plan**.

## P. Remove a Theme

User specifies `theme_name`. Confirm before destructive removal:

> *Output the next fenced block as markdown (not a code block):*

```
> Removing "{theme_name}" will drop its drafted content. Has its
> content been reabsorbed into another theme, or are you intentionally
> discarding it?
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Remove the theme and drop its content
- **`n`/`no`** — Back out
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

1. Read `plan.json`. Remove the theme entry.
2. Write `plan.json`.
3. ```bash
   rm .workflows/.cache/{work_unit}/legacy-split/{current_source}/{theme_name}.md
   ```

→ Return to **F. Propose Plan**.

#### If `no`

→ Return to **F. Propose Plan**.
