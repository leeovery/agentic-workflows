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

Apply the user's edit to the in-memory theme list. After applying, re-classify each affected theme (`stays` if name equals `current_source`; `merges` if name matches another `existing_names` entry; `creates` otherwise). If the user renamed a theme away from a dismissed name, also clear `pull_dismissed` on that theme.

→ Return to **A. Display Themes**.

#### If `abandon`

Set `abandoned = true`.

→ Return to caller.

## C. Validate Constraints

Three checks run in order. The first matching check renders a message and routes back to **B**; if none matches, the per-`creates` topic-name validation runs.

#### If more than one theme is classified `stays`

The source file can only represent one theme.

> *Output the next fenced block as a code block:*

```
Two themes share the source name "{current_source}". Rename one
or merge them — the source file can only represent one theme.
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

Set `pull_dismissed = true` on the theme. Continue to the next theme.

**If result is `ok`:**

Continue to the next theme.

Once all `creates` themes have validated (`stays` and `merges` need no validation — the name is already on the map or equals the source file):

→ Proceed to **D. Final Confirmation**.

## D. Final Confirmation

Build:
- `approved_creates` — `creates` themes with `kebab_name`, `summary`, `description`, `routing`, `content`, optional `pull_dismissed`
- `approved_merges` — `merges` themes with `target_name`, `content`
- `approved_stays` — `stays` themes with `kebab_name`, `summary`, `content` (at most one, validated in **C**; `summary` is required because apply-split D uses it as the source-file "Brief description" when rewriting)

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
