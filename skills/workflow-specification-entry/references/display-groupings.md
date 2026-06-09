# Display: Groupings

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Shows when proposed groupings exist (directly from routing) or after analysis completes. This is the most content-rich display.

## A. Load Groupings

Each grouping is a specification item from the discovery `specifications` array — proposed items and materialized specs alike. The item *is* the grouping: its `sources` are the grouping's discussions, its `status` drives the verb, its `consult_references` are the consult slices it owes.

For consult-slice **hints** (the human-readable "which slice / why"), read `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` if present and match each grouping's `**Consult**` lines by name. The manifest holds the authoritative grouping→source mapping; the `.md` only enriches consult descriptions.

→ Proceed to **B. Determine Discussion Status**.

---

## B. Determine Discussion Status

The item *is* the grouping — there is no name-matching step. Determine each discussion's status from the item's `status` and `sources`.

#### If the item status is `proposed`

The grouping has no spec yet. Each source discussion's status is `ready`. Each consult reference's status is `pending`. Spec status: `none`.

→ Proceed to **C. Display**.

#### Otherwise

The item is a materialized spec (`in-progress` or `completed`). For each source in the item's `sources` array:
- `incorporated` + `discussion_status: completed` or `not-found` → `extracted`
- `incorporated` + `discussion_status: other` (e.g. `in-progress`) → `extracted, reopened`
- `pending` → `pending`

Spec status: show the item's actual status with extraction count `({X} of {Y} sources extracted)`. Y = count of unique discussions in the item's sources; X = count of those with `incorporated` status. Sources with `discussion_status: "not-found"` (deleted discussions) are silently skipped.

**Consult references:** For each entry on the item's `consult_references` array, use its `status` (`pending` or `addressed`).

→ Proceed to **C. Display**.

---

## C. Display

The tree and menu render only **actionable** groupings — every item except the concluded ones (`status: completed` with `has_pending_sources: false`). Concluded specs move to the `c`/`completed` submenu so finished work doesn't crowd the work-first list. Render actionable items in the discovery script's `specifications[]` order (already sorted proposed → in-progress → completed-with-pending). The numbered tree and the menu options must use the same ordering and numbering — they map 1:1.

All actionable items are first-class — every grouping (including single-discussion entries) is a numbered item.

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Specification Overview
●───────────────────────────────────────────────●

Recommended breakdown for specifications with their source discussions.

1. {grouping_name:(titlecase)}
   └─ Spec: @if(has_spec) {spec_status:[in-progress|completed]} ({extraction_summary}) @else [no spec] @endif
   └─ Discussions:
      ├─ {discussion} [{status:[extracted|pending|ready|reopened]}]
      └─ ...
   └─ Consult:
      ├─ {ref-topic} [{status:[pending|addressed]}]
      └─ ...

2. ...
```

Omit the `Consult:` branch for groupings with no consult references.

#### If in-progress discussions exist

> *Output the next fenced block as a code block:*

```
⚑ Discussions not ready for specification:
  These discussions are still in progress and must be completed
  before they can be included in a specification.

  • {discussion-name}
```

### Key/Legend

Show only the statuses that appear in the current display. No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Discussion status:
    extracted — content has been incorporated into the specification
    pending   — listed as source but content not yet extracted
    ready     — completed and available to be specified
    reopened  — was extracted but discussion has regressed to in-progress

  Consult status:
    pending   — sibling correction not yet read in and reconciled
    addressed — correction applied or cited; reconciliation recorded

  Spec status:
    in-progress — specification work is ongoing
    completed   — specification is done
```

### Tip (show when 2+ groupings)

No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Tip: To restructure groupings or pull a discussion into its own
specification, choose "Re-analyze" and provide guidance.
```

→ Proceed to **D. Menu**.

---

## D. Menu

Present one numbered menu entry per **actionable** grouping — the same set the tree showed, in the same order. The verb and description depend on the item's status:

- Status `proposed` → **Start** "{Name}" — {N} ready discussions
- Status `in-progress` with pending sources → **Continue** "{Name}" — {N} source(s) pending extraction
- Status `in-progress` with all extracted → **Continue** "{Name}" — all sources extracted
- Status `completed` with pending sources → **Continue** "{Name}" — {N} new source(s) to extract

Concluded groupings (`completed` with no pending sources) are not numbered here — they live behind `c`/`completed`.

When the grouping has pending consult references, append `— {N} consult ref(s) pending` to its description. Do not change the verb — consult references gate completion but never introduce a new action.

After all grouping entries, append meta options:

- **Unify all** (only when 2+ groupings exist) — all discussions combined into one specification instead of following the recommended groupings. If specs exist, note they will be incorporated and superseded.
- **Re-analyze groupings** (always) — current groupings are discarded and rebuilt. If specs exist, existing names are preserved. User can provide guidance in the next step.

Then, after the numbered and meta options, append the command option (only when `concluded_count > 0`):

- **`c`/`completed`** — Manage completed specifications — {concluded_count} completed

**Example assembled menu** (2 actionable groupings, 1 concluded spec):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`1`** — Start "Auth Flow" — 2 ready discussions
- **`2`** — Continue "Data Model" — 1 source(s) pending extraction — 1 consult ref(s) pending
- **`3`** — Unify all into single specification
   `All discussions are combined into one specification. Existing`
   `specifications are incorporated and superseded.`
- **`4`** — Re-analyze groupings
   `Current groupings are discarded and rebuilt. Existing`
   `specification names are preserved. You can provide guidance`
   `in the next step.`

- **`c`/`completed`** — Manage completed specifications — 1 completed

Select an option:
· · · · · · · · · · · ·
```

Recreate with actual topics and states from discovery.

Every meta option (Unify, Re-analyze) MUST include its description lines. Omit the `c`/`completed` option when `concluded_count` is 0.

**STOP.** Wait for user response.

#### If user picks a grouping

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If user picks `c`/`completed`

→ Load **[display-completed-specs.md](display-completed-specs.md)** and follow its instructions as written.

→ Return to **D. Menu**.

#### If user picks `Unify all`

Reconcile the manifest to a single proposed grouping immediately, so it never lags the cache. The target proposed set is `{unified}`:
1. Delete every existing proposed item (reconcile step 5 — none survive into the target set).
2. Upsert `unified` as a proposed item with every completed discussion as a `pending` source (reconcile step 7):
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.unified status proposed
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.unified sources.{discussion}.status pending
   ```

Then rewrite `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` with a single "Unified" grouping containing all completed discussions. Keep the same checksum, update the generated timestamp. Add note: `Custom groupings confirmed by user (unified).`

Commit: `spec({work_unit}): reconcile proposed groupings`

Spec name: "Unified". Sources: all completed discussions.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If user picks `Re-analyze`

Delete the cache:
```bash
rm .workflows/{work_unit}/.state/discussion-consolidation-analysis.md
```

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.
