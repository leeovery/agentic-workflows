# Display: Groupings

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Shows when cache is valid (directly from routing) or after analysis completes. This is the most content-rich display.

## A. Load Groupings

Load groupings from `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md`. Parse the `### {Name}` headings and their discussion lists.

→ Proceed to **B. Determine Discussion Status**.

---

## B. Determine Discussion Status

For each grouping, convert the name to kebab-case and check if a matching specification exists in the discovery `specifications` array.

#### If a matching spec exists

For each discussion in the grouping:
- Look up in the spec's `sources` array (by `name` field)
- If found → use the source's `status` (`incorporated` → `extracted`, `pending` → `pending`)
- If NOT found → status is `pending` (new source not yet in spec)

Spec status: show actual status with extraction count `({X} of {Y} sources extracted)`.

**Regressed sources:** After processing the grouping's discussions, check the spec's
`sources` array from discovery. For any source where `discussion_status` is neither
`completed` nor `not-found`, and the source is not already in the grouping:
- Add it to the discussion tree with status `(extracted, reopened)`

These represent sources that were incorporated but whose discussions have since
regressed to in-progress. Sources with `discussion_status: "not-found"` (deleted
discussions) are silently skipped — there is nothing actionable.

**Extraction count:** Y = count of unique discussions in (spec sources ∪ grouping members). X = count of those with `incorporated` status in spec sources. This ensures regressed sources that dropped out of the grouping still count toward Y.

→ Proceed to **C. Display**.

#### Otherwise

For each discussion: status is `ready`. Spec status: `none`.

→ Proceed to **C. Display**.

---

## C. Display

All items are first-class — every grouping (including single-discussion entries) is a numbered item.

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Specification Overview
●───────────────────────────────────────────────●

Recommended breakdown for specifications with their source discussions.

1. {grouping_name:(titlecase)}
   └─ Spec: @if(has_spec) {spec_status:[in-progress|completed]} ({extraction_summary}) @else (no spec) @endif
   └─ Discussions:
      ├─ {discussion} ({status:[extracted|pending|ready|reopened]})
      └─ ...

2. ...
```

#### If in-progress discussions exist

> *Output the next fenced block as a code block:*

```
Discussions not ready for specification:
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

Present one numbered menu entry per grouping. The verb and description depend on the grouping's spec state:

- No spec exists → **Start** "{Name}" — {N} ready discussions
- Spec is `in-progress` with pending sources → **Continue** "{Name}" — {N} source(s) pending extraction
- Spec is `in-progress` with all extracted → **Continue** "{Name}" — all sources extracted
- Spec is `completed` with no pending sources → **Refine** "{Name}" — completed spec
- Spec is `completed` with pending sources → **Continue** "{Name}" — {N} new source(s) to extract

After all grouping entries, append meta options:

- **Unify all** (only when 2+ groupings exist) — all discussions combined into one specification instead of following the recommended groupings. If specs exist, note they will be incorporated and superseded.
- **Re-analyze groupings** (always) — current groupings are discarded and rebuilt. If specs exist, existing names are preserved. User can provide guidance in the next step.

**Example assembled menu** (2 groupings, specs exist):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
1. Start "Auth Flow" — 2 ready discussions
2. Continue "Data Model" — 1 source(s) pending extraction
3. Unify all into single specification
   `All discussions are combined into one specification. Existing`
   `specifications are incorporated and superseded.`
4. Re-analyze groupings
   `Current groupings are discarded and rebuilt. Existing`
   `specification names are preserved. You can provide guidance`
   `in the next step.`

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual topics and states from discovery.

Every meta option (Unify, Re-analyze) MUST include its description lines.

**STOP.** Wait for user response.

#### If user picks a grouping

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If user picks `Unify all`

Update the cache: rewrite `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` with a single "Unified" grouping containing all completed discussions. Keep the same checksum, update the generated timestamp. Add note: `Custom groupings confirmed by user (unified).`

Spec name: "Unified". Sources: all completed discussions.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If user picks `Re-analyze`

Delete the cache:
```bash
rm .workflows/{work_unit}/.state/discussion-consolidation-analysis.md
```

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.
