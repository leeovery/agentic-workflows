# Summary Backfill

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

The caller passes:

- `work_unit` — the selected epic
- `items_to_recover` — list of discovery items missing summary, description, or both. Each item has at minimum `name`, `routing`, `summary_present`, `description_present`, plus the current value of `summary` (null when `summary_present` is false)

## A. Read Source Files

> *Output the next fenced block as a code block:*

```
── Summary Backfill ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Discovery items missing summary or description. Drafting
> them from the existing research and discussion files for
> review.
```

For each item in `items_to_recover`:

- If `routing` is `research`: read `.workflows/{work_unit}/research/{item.name}.md`
- If `routing` is `discussion`: read `.workflows/{work_unit}/discussion/{item.name}.md`
- If the file is missing or empty (rare — the topic exists in the manifest but the file is gone), record `derived_summary: null` and `derived_description: null` and a note `(source file missing)` for that item

For each readable file:

- Set `item.needs_summary = !item.summary_present` and `item.needs_description = !item.description_present` so section **D** writes only the newly-drafted fields.
- If `item.needs_summary`, derive a one-line summary that captures what the topic is about. Aim for 8–15 words. Use the file's headings and opening paragraphs as the primary signal. Attach as `item.derived_summary`.
- If `item.needs_description`, derive a paragraph or two of richer context — what the topic covers, why it surfaced, key dimensions. Use the file's body content (not just headings). Attach as `item.derived_description`.
- If a field is already populated, leave its current value in place and skip derivation for that field.

→ Proceed to **B. Batch Review**.

## B. Batch Review

Render the proposed summaries as a single batch. Description is drafted silently in the background — paragraphs would bloat the batch view, and entry skills will use whatever the auto-draft produces. The user can edit a description later via a follow-up discovery session.

> *Output the next fenced block as a code block:*

```
Proposed summaries for {N} topic(s):

@foreach(item in items_to_recover)
  {N}. {item.name:(titlecase)}  ({item.routing})
@if(item.needs_summary and item.derived_summary)
       {item.derived_summary}
@elseif(item.needs_summary)
       (source file missing — please provide)
@else
       {item.summary}  (already populated)
@endif
@endforeach
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Accept all summaries as drafted (description is auto-drafted silently)
- **`e`/`edit`** — Edit one or more summary lines before accepting
- **`s`/`skip`** — Skip the whole batch (leave fields blank)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **D. Write and Commit**.

#### If `edit`

→ Proceed to **C. Edit Loop**.

#### If `skip`

No manifest writes, no commit.

→ Return to caller.

## C. Edit Loop

> *Output the next fenced block as a code block:*

```
Which line would you like to edit? Enter the number, or `done` to accept the current set.
```

**STOP.** Wait for user response.

#### If `done`

→ Proceed to **D. Write and Commit**.

#### If a number

> *Output the next fenced block as a code block:*

```
New summary for "{item.name:(titlecase)}":
```

**STOP.** Wait for user response.

Update the in-memory summary for that item with the user's response. Re-render the batch from **B** so the user can see the updated state, then return to the prompt at the top of this section.

→ Return to **C. Edit Loop**.

## D. Write and Commit

For each item, write only the newly-drafted fields:

- If `item.needs_summary` is true and `item.derived_summary` is non-null:

  ```bash
  node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{item.name} summary "{summary}"
  ```

- If `item.needs_description` is true and `item.derived_description` is non-null:

  ```bash
  node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{item.name} description "{description}"
  ```

Skip items where the relevant derived field is null (source file was missing) — they remain unset and will trigger this flow again on the next workflow-continue-epic invocation, giving the user another chance.

Single commit covering all writes:

```bash
git add -- .workflows/{work_unit}/manifest.json
git commit -m "discovery({work_unit}): backfill {N} discovery provenance field(s) from source files"
```

→ Return to caller.
