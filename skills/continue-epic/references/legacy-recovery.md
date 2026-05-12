# Legacy Recovery

*Reference for **[continue-epic](../SKILL.md)***

---

One-time recovery flow for inception items seeded by migration 038. Migrated items have routing + source but no `summary` — this reference reads the corresponding research/discussion file for each item, derives a one-line summary, and writes it to the manifest after user review.

Loaded conditionally from continue-epic Step 6 when the discovery output contains items where `source` starts with `'migration-seeded'` and `summary` is null. The `startsWith` check matches both `migration-seeded` and `migration-seeded,<analysis>` — the latter happens when Phase 7's self-healing analyses re-surface a migrated topic and append their tag without writing a summary. When all migration-seeded items have summaries, the conditional never fires — this reference becomes unreachable and can be deleted in a follow-up cleanup PR.

The caller passes:
- `work_unit` — the epic being viewed
- `items_to_recover` — the list of migration-seeded items with null summary, sourced from the discovery output's `discovery_map`

Each item has at minimum `name` and `routing`. `routing` determines which source file to read.

## A. Read Source Files

> *Output the next fenced block as markdown (not a code block):*

```
> Found {N} item(s) carried over from before the discovery-map system.
> Reading the existing research/discussion file(s) to draft summaries.
```

For each item in `items_to_recover`:

- If `routing` is `research`: read `.workflows/{work_unit}/research/{item.name}.md`
- If `routing` is `discussion`: read `.workflows/{work_unit}/discussion/{item.name}.md`
- If the file is missing or empty (rare — the topic exists in the manifest but the file is gone), record `summary: null` and a note `(source file missing)` for that item

For each readable file, derive a one-line summary that captures what the topic is about. Aim for 8–15 words. Use the file's headings and opening paragraphs as the primary signal.

→ Proceed to **B. Batch Review**.

## B. Batch Review

Render the proposed summaries as a single batch:

> *Output the next fenced block as a code block:*

```
Proposed summaries for {N} migrated topic(s):

@foreach(item in items_to_recover)
  {N}. {item.name:(titlecase)}  ({item.routing})
@if(item.derived_summary)
       {item.derived_summary}
@else
       (source file missing — please provide)
@endif
@endforeach
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Accept all summaries as drafted
- **`e`/`edit`** — Edit one or more lines before accepting
- **`s`/`skip`** — Skip the whole batch (leave summaries blank)
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

For each item with a non-null summary, write to the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{item.name} summary "{summary}"
```

Skip items where the summary is null (source file was missing) — they remain unset and will trigger this flow again on the next continue-epic invocation, giving the user another chance to provide a summary manually.

Single commit covering all writes:

```bash
git add -- .workflows/{work_unit}/manifest.json
git commit -m "inception({work_unit}): populate {N} migration-seeded summary(ies) from source files"
```

Re-run discovery so continue-epic's display step renders fresh state:

```bash
node .claude/skills/continue-epic/scripts/discovery.cjs {work_unit}
```

→ Return to caller.
