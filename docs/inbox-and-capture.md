# Inbox and Capture

Ideas arrive at inconvenient times: mid-review, mid-discussion, mid-anything. The inbox is where they go so the current work doesn't absorb them and the thought doesn't evaporate. It is pre-pipeline by design: markdown files in `.workflows/.inbox/{ideas,bugs,quickfixes}/`, no manifest, no state, nothing to maintain.

## Capture

Three lightweight skills write inbox files: `/workflow-log-idea`, `/workflow-log-bug`, `/workflow-log-quickfix`. Each synthesises from conversation context when it exists, or draws the thought out in two to four exchanges from a cold start, then writes `{YYYY-MM-DD}--{slug}.md` with an H1 title and a prose body.

What makes them work is what they refuse to do. The capture constraints are rules, not guidelines: no reading code, no web searches, no feasibility validation, no architecture suggestions, no devil's advocate, no proposed next steps. Capture is capture. The moment a logging skill starts "helping", it becomes a planning session you didn't ask for.

Capture also happens *from inside* the pipeline. [Discovery's](discovery.md) scope-down move offers the inbox for tangents that don't fit the work being shaped, and a [discussion](research-and-discussion.md#off-topic-concerns) hitting an out-of-scope concern on single-topic work offers to log it. In both cases the capture is committed immediately, so it survives even if the session that spawned it is abandoned.

## The working set

`/workflow-start` surfaces the inbox when items exist, and pickup is built around a **working set**: one or more selected items that every action applies to. The set renders as a summarised tree (title, type, three-line summary per item) with a menu:

- **`a`/add · `d`/drop**: grow or narrow the set. Both accept named items in the same breath ("add 2 and 4", "drop the bug") without a re-prompt.
- **`v`/view**: full content of everything in the set.
- **`r`/archive**: move the whole set out of the inbox, one engine transaction, one commit.
- **`w`/work**: promote the set into new work.

`w`/work is gated on type uniformity: it renders only when every item in the set shares one type, because a mixed set can't pre-seed a single work type. The flag says so on the render (`⚑ Work is unavailable while the set mixes types`). A uniform set routes into [discovery](discovery.md) with its type as the pre-seed (bugs → bugfix, quick-fixes → quick-fix, ideas → open) and the items as opening seed material, still confirmed in conversation like any other pick.

## Seeds: where promoted items end up

Promotion is a *move*, not a copy. At discovery's [work-type commit](discovery.md#the-confirm-trigger-the-durability-boundary), the engine moves each chosen file out of the inbox into the new work unit's `seeds/` directory, records it in the manifest's `seeds[]` with a `source: inbox:{idea|bug|quickfix}` provenance tag, and indexes it into the [knowledge base](knowledge-base.md) under the `seeds` phase.

Seeds are deliberately distinct from **imports** (`imports/`, the `imports[]` field): a seed is the work's *origin*, the captured thought it grew from; an import is reference material the user shared along the way. The first phase reads seeds as its primary launchpad and imports as supporting context, and both remain retrievable later, when someone asks "what was the original framing of this?".

## The archive

Declined items don't get deleted; they get archived to `.inbox/.archived/{type}/`, and the archive is a live store with its own view from the inbox screen: restore an item back to the inbox, or hard-delete it (`git rm`) when it's truly dead. All three moves (archive, restore, delete) are engine `inbox` transactions with strict path validation and one commit per batch. The distinction the structure enforces: `.archived/` holds items you *declined*, never items you promoted, so the inbox's history stays honest about which thoughts became work.

---

*Next: changing a work unit's shape or state after the fact, [lifecycle tools](lifecycle-tools.md).*
