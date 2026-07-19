# Summary Backfill

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

The caller passes:

- `work_unit` — the selected epic
- `items_to_recover` — list of discovery-map rows missing summary, description, or both. Each row carries `name`, `routing`, `summary=present|absent`, `description=present|absent`, and — after `—` — the current summary text when present

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

- Set `item.needs_summary` from the row's `summary=absent` and `item.needs_description` from `description=absent` so section **D** writes only the newly-drafted fields.
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

**If any item's needed field is still null** (source file missing, nothing provided via the edit loop), give it an exit — otherwise it re-triggers this flow on every epic entry forever:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{K} topic(s) have no source file to draft from:

@foreach(item in items_to_recover where derived field is null)
- {item.name:(titlecase)}
@endforeach

- **`p`/`provide`** — Tell me the summary for each and I'll write it
- **`d`/`dismiss`** — Write a minimal name-derived summary noting the missing source, so this stops re-prompting
- **`l`/`leave`** — Leave them unset; this flow re-offers next time
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `provide`:** set each item's derived field from the user's text and include it in the writes below.

**If `dismiss`:** for each such item, set the null field(s) to a minimal value derived from the topic name and routing, ending `(source artifact missing)`, and include them in the writes below.

**If `leave`:** the items stay out of the writes below and re-qualify on the next epic entry.

For each item, write only the newly-drafted fields:

- If `item.needs_summary` is true and `item.derived_summary` is non-null:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery.{item.name} summary "{summary}"
  ```

- If `item.needs_description` is true and `item.derived_description` is non-null:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discovery.{item.name} description "{description}"
  ```

Single commit covering all writes:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): backfill {N} discovery provenance field(s) from source files"
```

→ Return to caller.
