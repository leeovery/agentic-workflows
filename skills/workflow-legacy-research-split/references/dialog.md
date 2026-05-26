# Session Loop

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Drive the per-source iteration: read source, identify themes, early sanity gate, draft cache, propose, edit, validate, apply. Edit operations live in their own lettered sections (K–R) dispatched from G.

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

Identify distinct themes holistically. Theme-identification rules:

- **Coherent domains, not one-theme-per-component.** A theme is a topic that could stand alone as a discussion or research target. If two candidate themes always come up together in the source, they're one theme.

- **Prefer fewer, coarser themes.** Two to six themes is typical for most sources. If you find yourself heading higher, pause and re-check using the independence test below — but if more themes are genuinely warranted by the source, that's fine; don't force-merge unrelated material.

- **Independence test.** If working on theme A would constantly require referencing theme B, they belong together. Themes sharing the same domain, data model, user journey, or decision space should merge.

- **Anti-pattern — one theme per implementation concern within one domain.** A broad `auth` source surfacing API authentication, password hashing, session management, OAuth, token refresh, and rate limiting is NOT six themes. Same user, same security boundary, same session lifecycle — one theme: `auth`.

- **Anti-pattern — one theme per system component.** A broad `pipeline` source surfacing ingestion, schema validation, transformation rules, error handling, retry logic, and dead-letter queues is NOT six themes. Each is a stage in the same pipeline — one theme: `data-pipeline`.

- **When to split.** Themes have genuinely different stakeholders, concerns, or decision spaces that can be explored independently.

- **Semantic allocation; rewriting for flow allowed.** Each theme's cache file may rewrite source paragraphs for flow, may overlap mildly with siblings where the source itself overlaps, and need not be a strict partition of the source.

- **Name reuse is fine.** If a theme naturally reuses the source's own name (e.g. `auth` decomposed into `auth` + `caching`), that's just a normal `creates` theme — the source rename frees the name.

For each candidate theme, build a tentative entry:

- `kebab_name` — short, kebab-cased
- `summary` — one line
- `classification` — `creates` if standalone topic; `merges` if the content belongs in an existing topic
- `target_name` — required when `classification == merges`; names the existing topic
- `routing` — `discussion` (well-explored, ready) or `research` (under-explored)

Hold these in working memory. Do NOT write any cache files yet.

→ Proceed to **D. Confirm Theme List**.

## D. Confirm Theme List

Display the candidate theme list. This is an early sanity gate — catch obvious over- or under-splitting BEFORE drafting any cache files.

> *Output the next fenced block as a code block:*

```
Candidate themes for {current_source}.md:

@foreach(theme in candidates)
{N}. {theme.kebab_name}  [{theme.classification}@if(theme.classification == 'merges') → {theme.target_name}@endif]
   └─ {theme.summary}
   └─ Routing: {theme.routing}
@endforeach
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Proceed to draft cache files
- **Redirect** — Adjust the theme list (rename, merge two, split one, add, remove, change classification/routing)
- **`a`/`abandon`** — Skip this source file
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **E. Draft Cache Files**.

#### If redirect

Apply the user's adjustment in working memory (no files written yet). Supported in-memory operations:

- **Rename** — update `kebab_name` on the named theme
- **Change routing** — flip `routing` on the named theme
- **Change classification** — flip `creates` ↔ `merges` (when becoming `merges`, ask user for `target_name`)
- **Change target** — update `target_name` on a `merges` theme
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

The body is the substantive prose for this theme (not an empty stub). Drawn from the source, rewritten for flow where helpful. For a `merges` theme, this is what will be appended to the existing target file. For a `creates` theme, this is the new file body.

Each cache file must be non-empty (not just whitespace) and the corresponding `description` field (added in F) must be at least a paragraph or two — `validate.cjs` enforces both.

Build `plan.json` from the candidate list and write to:

```
.workflows/.cache/{work_unit}/legacy-split/{current_source}/plan.json
```

Schema:

```json
{
  "themes": [
    {
      "kebab_name":     "auth",
      "summary":        "one-line summary",
      "description":    "paragraph or two synthesised from the source",
      "routing":        "discussion" | "research",
      "classification": "creates" | "merges",
      "target_name":    "existing-topic"
    }
  ]
}
```

`target_name` only when `classification == "merges"`.

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
{N}. {theme.kebab_name}  [{theme.classification}]
   └─ Summary: {theme.summary}
   └─ Routing: {theme.routing}
   @if(theme.classification == 'merges')
   └─ Merges into: {theme.target_name}
   @endif
   └─ Content: {paragraph_count} para(s) — "{content_preview}..."
   └─ Cache: .workflows/.cache/{work_unit}/legacy-split/{current_source}/{theme.kebab_name}.md
@endforeach

Source file will be renamed to {current_source}-superseded-{datetime}.md.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Apply this plan
- **Edit** — Modify cache files or plan.json (rename, change routing, merge, split, add, remove). To rewrite a draft, edit the cache file directly between renders.
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

#### If the edit is a routing change

→ Proceed to **L. Change Routing**.

#### If the edit is a classification change

→ Proceed to **M. Change Classification**.

#### If the edit is a merge-target change

→ Proceed to **N. Change Merge Target**.

#### If the edit merges two themes

→ Proceed to **O. Merge Two Themes**.

#### If the edit splits one theme

→ Proceed to **P. Split One Theme**.

#### If the edit adds a theme

→ Proceed to **Q. Add a Theme**.

#### If the edit removes a theme

→ Proceed to **R. Remove a Theme**.

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
Applied {current_source}: {applied.creates} new file(s), {applied.merges} merge(s).
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

## L. Change Routing

User specifies `theme_name` and new `routing` (`discussion` | `research`).

1. Read `plan.json`. Set the theme's `routing` to the new value.
2. Write `plan.json`.

→ Return to **F. Propose Plan**.

## M. Change Classification

User specifies `theme_name` and new `classification` (`creates` | `merges`).

#### If becoming `merges`

Ask the user for the merge target. If they've already named one in the same turn, skip ahead.

> *Output the next fenced block as markdown (not a code block):*

```
> What's the target topic for "{theme_name}" to merge into?
```

**STOP.** Wait for user response.

1. Read `plan.json`. Set the theme's `classification` to `merges` and `target_name` to the supplied value.
2. Write `plan.json`.

→ Return to **F. Propose Plan**.

#### If becoming `creates`

1. Read `plan.json`. Set the theme's `classification` to `creates`. Delete `theme.target_name` if present.
2. Write `plan.json`.

→ Return to **F. Propose Plan**.

## N. Change Merge Target

User specifies `theme_name` and new `target_name`.

1. Read `plan.json`. Set `theme.target_name` to the new value.
2. Write `plan.json`.

→ Return to **F. Propose Plan**.

## O. Merge Two Themes

User specifies `theme_a`, `theme_b`, and `surviving_name` (often equal to `theme_a` or `theme_b`).

1. Read both cache files into memory.
2. Concatenate the bodies (with a blank line between) and write the result to `.workflows/.cache/{work_unit}/legacy-split/{current_source}/{surviving_name}.md`.
3. Delete the originals that didn't survive:
   - If `surviving_name == theme_a`: `rm .workflows/.cache/{work_unit}/legacy-split/{current_source}/{theme_b}.md`
   - If `surviving_name == theme_b`: `rm .workflows/.cache/{work_unit}/legacy-split/{current_source}/{theme_a}.md`
   - Otherwise (new name): `rm` both originals.
4. Read `plan.json`. Remove both original theme entries. Add a new entry with `kebab_name = surviving_name`, summary/description merged or rewritten as the user directs, routing/classification per the user's instruction.
5. Write `plan.json`.

→ Return to **F. Propose Plan**.

## P. Split One Theme

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
4. Read `plan.json`. Remove the original theme entry. Add two new entries (`name_a`, `name_b`) with appropriate summary/description/routing/classification. If any field is ambiguous, ask one clarifying question before proceeding — this is conversational flow, not a structured STOP.
5. Write `plan.json`.

→ Return to **F. Propose Plan**.

## Q. Add a Theme

User specifies `kebab_name`, summary, description, routing, classification, and the content for the new cache file.

1. Read `plan.json`. Add the new theme entry.
2. Write `plan.json`.
3. Write the cache file at `.workflows/.cache/{work_unit}/legacy-split/{current_source}/{kebab_name}.md`.

→ Return to **F. Propose Plan**.

## R. Remove a Theme

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
