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

Handle edits iteratively. After each edit, re-classify the affected theme(s) (`stays` if name equals `current_source`; `merges` if name matches another `existing_names` entry; `creates` otherwise), re-render the list (format from **A**), and re-prompt.

When the user signals done editing:

→ Proceed to **C. Validate Names**.

#### If `abandon`

Set `abandoned = true`.

→ Return to caller.

## C. Validate Names

For each `creates` theme:

→ Load **[topic-name-validation.md](../../workflow-shared/references/topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{kebab_name}`.

On `collision-active`: re-prompt for an alternative `kebab_name`; re-validate.
On `matches-dismissed`: set `pull_dismissed = true` on the theme — the apply step will pull from the dismissed list before writing.
On `ok`: proceed.

`stays` and `merges` themes need no validation — the name is already on the map (or equals the source file).

→ Proceed to **D. Final Confirmation**.

## D. Final Confirmation

Build:
- `approved_creates` — `creates` themes with `kebab_name`, `summary`, `description`, `routing`, `content`, optional `pull_dismissed`
- `approved_merges` — `merges` themes with `target_name`, `content`
- `approved_stays` — `stays` themes with `kebab_name`, `content` (at most one)

If `approved_stays.length > 1` (two themes share `current_source` as their name — invalid: the source file can only represent one theme), re-render and route back to **B. Offer Edits** with a note asking the user to rename or merge the duplicates.

> *Output the next fenced block as a code block:*

```
Final plan for {current_source}.md:

@if(approved_stays.length > 0)
Stays under source name ({current_source}):
  • {kebab_name}
  @if(approved_creates.length + approved_merges.length > 0)
  (source file will be rewritten with this theme's content only —
   the rest moves to new/merge targets)
  @else
  (source file untouched — no other themes to move out)
  @endif
@endif

@if(approved_merges.length > 0)
Merges into existing files:
@foreach(m in approved_merges)
  • {m.target_name}
@endforeach
@endif

@if(approved_creates.length > 0)
Creates new files:
@foreach(c in approved_creates)
  • {c.kebab_name} ({c.routing}) — {c.summary}
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
