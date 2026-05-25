# Propose Candidates

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Present themes to the user and accept edits. Every theme must land somewhere — `stays`, `merges`, or `creates`. No outright rejection.

## A. Display Themes

> *Output the next fenced block as a code block:*

```
·· Propose Themes ·······························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Themes identified in {current_source}.md. Every theme routes to
> a destination — content is preserved either in place, merged
> into an existing topic, or moved into a new file.
```

For each theme, count the paragraphs in `theme.content` and render a one-line content preview (first ~60 chars of the first paragraph, single-line) so the user can see how the source was allocated.

> *Output the next fenced block as a code block:*

```
@foreach(theme in themes)
{N}. {kebab_name}  [{classification}]
   └─ Summary: {summary}
   └─ Routing: {routing}
   └─ Content: {paragraph_count} para(s) — "{content_preview}..."
   @if(classification == 'merges') └─ Merges into existing {kebab_name} @endif
   @if(classification == 'stays') └─ Keeps source name @endif

@endforeach
```

→ Proceed to **B. Offer Edits**.

## B. Offer Edits

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Apply as proposed
- **Edit** — Rename, change routing, merge two, split one, or move content between themes
- **`a`/`abandon`** — Skip this source file
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **C. Validate Names**.

#### If edit

Apply the user's edit. The supported edit operations:

- **Rename** — change `theme.kebab_name`. Re-classify the theme (`stays` if name now equals `current_source`; `merges` if name now matches another `existing_names` entry; `creates` otherwise).
- **Change routing** — change `theme.routing` between `discussion` and `research`.
- **Re-allocate paragraphs** — move one or more source paragraphs between themes (e.g., "move the caching-header paragraph from theme A to theme B"). Update each affected theme's `theme.content`. This is the operation that fixes empty-content failures in **C**.
- **Merge two themes** — combine their content into one. Drop the other theme. Re-classify the survivor.
- **Split a theme** — create a new theme from a subset of the original's content. The new theme starts with content from the original (which now has the remainder).
- **Add a theme** — only valid if the user has un-allocated source content to assign to it.

If the user renamed a theme away from a dismissed name, clear `pull_dismissed` on that theme.

→ Return to **A. Display Themes**.

#### If `abandon`

Set `abandoned = true`.

→ Return to caller.

## C. Validate Constraints

Before evaluating, unconditionally clear `pull_dismissed` on every theme. C re-derives it during per-`creates` validation, so any stale flag from a prior C→B→C cycle (e.g., user edited a theme to a dismissed name, then renamed away in B) starts fresh.

Three checks then run in order. The first matching check renders a message and routes back to **B**; if none matches, the per-`creates` topic-name validation runs.

#### If more than one theme is classified `stays`

The source file can only represent one theme.

> *Output the next fenced block as a code block:*

```
Two themes share the source name "{current_source}". Rename one
or merge them — the source file can only represent one theme.
```

→ Return to **B. Offer Edits**.

#### If two or more themes share the same `kebab_name`

A duplicate name would cause apply-split to overwrite one theme's file/manifest entry with the other's — silent content loss. Topic-name-validation only checks against the active map, not against other themes in this batch.

> *Output the next fenced block as a code block:*

```
Two themes share the kebab_name "{duplicate_name}". Rename one
or merge them.
```

→ Return to **B. Offer Edits**.

#### If any theme has empty `content`

A theme with no allocated paragraphs would produce an empty research file.

> *Output the next fenced block as a code block:*

```
Theme "{theme.kebab_name}" has no paragraphs allocated. Move
source content into it or remove the theme.
```

→ Return to **B. Offer Edits**.

#### If any theme has empty or whitespace-only `summary` or `description`

Apply-split writes these directly to the manifest. The Step 6 backfill filter in continue-epic treats null/missing as "needs backfill" but does not treat empty or whitespace-only strings the same — so a `""` or `"   "` value here would silently slip into the manifest and never get re-prompted.

> *Output the next fenced block as a code block:*

```
Theme "{theme.kebab_name}" has empty or whitespace-only summary
or description. Provide non-empty text for both.
```

→ Return to **B. Offer Edits**.

#### If `sum(theme.paragraph_count across all themes) != source_paragraph_count`

The themes' content does not partition the source — either paragraphs are missing (dropped from all themes) or duplicated (assigned to two themes). Session-loop C mandates that every paragraph lands in exactly one theme; this check enforces it.

> *Output the next fenced block as a code block:*

```
Theme content does not match the source. Allocated:
{total_allocated} paragraph(s) across {N} themes; source has
{source_paragraph_count}. Re-allocate so every source paragraph
appears in exactly one theme.
```

→ Return to **B. Offer Edits**.

#### Otherwise

For each theme with classification `creates`:

→ Load **[topic-name-validation.md](../../workflow-shared/references/topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{kebab_name}`.

**If result is `collision-active`:**

> *Output the next fenced block as a code block:*

```
Name "{kebab_name}" collides with an existing map item. Rename
this theme.
```

→ Return to **B. Offer Edits**.

**If result is `matches-dismissed`:**

Set `pull_dismissed = true` on the theme. Move on to the next iteration of the for-each loop.

**If result is `ok`:**

Move on to the next iteration of the for-each loop.

Once all `creates` themes have validated (`stays` and `merges` need no validation — the name is already on the map or equals the source file):

→ Proceed to **D. Final Confirmation**.

## D. Final Confirmation

Build:
- `approved_creates` — `creates` themes with `kebab_name`, `summary`, `description`, `routing`, `content`, optional `pull_dismissed`
- `approved_merges` — `merges` themes with `target_name`, `content`
- `approved_stays` — `stays` themes with `kebab_name`, `summary`, `description`, `content` (at most one, validated in **C**; `summary` and `description` are required so apply-split D can write them to the source's inception item — without these the migration-seeded item retains null metadata and Step 6 backfill re-prompts the user)

For each entry, render a content preview (paragraph count + first ~60 chars of the first paragraph) so the user can verify the allocation before approving — especially important for stays, where approval triggers a destructive source-file rewrite.

> *Output the next fenced block as a code block:*

```
Final plan for {current_source}.md:

@if(approved_stays.length > 0)
Stays under source name ({current_source}):
  • {approved_stays[0].kebab_name} — {approved_stays[0].paragraph_count} para(s)
    "{approved_stays[0].content_preview}..."
  @if(approved_creates.length + approved_merges.length > 0)
  (source file will be REWRITTEN to contain only the content above —
   the rest moves to new/merge targets)
  @else
  (source file untouched — no other themes to move out)
  @endif
@endif

@if(approved_merges.length > 0)
Merges into existing files:
@foreach(m in approved_merges)
  • {m.target_name} — {m.paragraph_count} para(s)
    "{m.content_preview}..."
@endforeach
@endif

@if(approved_creates.length > 0)
Creates new files:
@foreach(c in approved_creates)
  • {c.kebab_name} ({c.routing}) — {c.summary}
    {c.paragraph_count} para(s) — "{c.content_preview}..."
@endforeach
@endif

@if(approved_stays.length == 0)
Source ({current_source}) will be marked superseded.
@endif
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Apply this plan
- **`b`/`back`** — Go back to editing
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

Set `abandoned = false`.

→ Return to caller.

#### If `back`

→ Return to **A. Display Themes**.
