# Propose Candidates

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Present the themes identified in **[session-loop.md](session-loop.md)** to the user and accept edits. The user cannot reject content outright — every piece of source content must land somewhere (`stays`, `merges`, or `creates`).

## A. Display Themes

> *Output the next fenced block as a code block:*

```
·· Propose Themes ······························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Themes identified in {current_source}.md. Review and edit before
> applying. Every theme below routes to a destination — the source
> content is preserved either where it is, merged into an existing
> topic, or moved into a new file.
```

For each theme produced in **C. Identify Themes**, render an entry:

> *Output the next fenced block as a code block:*

```
@foreach(theme in themes)
{N}. {kebab_name}  [{classification}]
   └─ Summary: {summary}
   └─ Routing: {routing}
   @if(classification == 'merges') └─ Merges into existing item @endif
   @if(classification == 'stays') └─ Keeps the source file name; source file untouched @endif

@endforeach
```

→ Proceed to **B. Offer Edits**.

## B. Offer Edits

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Apply as proposed
- **Edit** — Rename a theme, change routing, merge two themes, split one theme, or move content between themes
- **`a`/`abandon`** — Skip this source file; leave it untouched
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **C. Validate Names**.

#### If edit

Engage in an iterative editing dialogue:
- **Rename**: change a theme's `kebab_name`. Re-classify (`stays` if it now matches source; `merges` if it now matches an existing map item; `creates` otherwise).
- **Change routing**: switch a theme between `research` and `discussion`.
- **Merge themes**: combine two themes' content under one `kebab_name`. Re-classify the result.
- **Split a theme**: introduce a new theme drawn from the original's content. Newcomer is classified per the same rules.
- **Move content**: shift content between themes (a paragraph from theme A to theme B).

After each edit, re-render the theme list (using the same format as **A**) and re-prompt.

When the user signals they're done editing, → Proceed to **C. Validate Names**.

#### If `abandon`

Set `abandoned = true`.

→ Return to caller.

## C. Validate Names

For every theme classified `creates` (new topic):

→ Load **[topic-name-validation.md](../../workflow-shared/references/topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{kebab_name}`.

On `collision-active`: re-prompt the user for an alternative kebab_name for this theme. Re-validate. Loop until `ok` or `matches-dismissed`.

On `matches-dismissed`: record `pull_dismissed = true` on the theme (the apply step will pull from the dismissed list before writing). Proceed.

On `ok`: proceed.

For themes classified `stays` or `merges`: no validation needed — the name is already on the map (or equals the source file).

→ Proceed to **D. Final Confirmation**.

## D. Final Confirmation

Categorise the themes:
- `approved_creates` = list of `creates` themes (each with `kebab_name`, `summary`, `description`, `routing`, `content`, optional `pull_dismissed`).
- `approved_merges` = list of `merges` themes (each with `target_name`, `content`).
- `approved_stays` = list of `stays` themes (each with `kebab_name`, `content`). At most one — the one matching `current_source`.

Render the final plan:

> *Output the next fenced block as a code block:*

```
Final plan for {current_source}.md:

@if(approved_stays.length > 0)
Stays in source file:
  • {kebab_name} — source file untouched
@endif

@if(approved_merges.length > 0)
Merges into existing files:
@foreach(m in approved_merges)
  • {m.target_name} — append content
@endforeach
@endif

@if(approved_creates.length > 0)
Creates new files:
@foreach(c in approved_creates)
  • {c.kebab_name} ({c.routing}) — {c.summary}
@endforeach
@endif

@if(approved_stays.length == 0)
Source ({current_source}) will be marked superseded — no theme kept the source name.
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
