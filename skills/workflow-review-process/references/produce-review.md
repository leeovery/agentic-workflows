# Produce Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

Aggregate QA findings into a review document using the **[template.md](template.md)**.

Write the review to `.workflows/{work_unit}/review/{topic}/report.md`. The review is always per-plan.

**QA Verdict** (from Step 5):
- **Approve** — All acceptance criteria met, no blocking issues
- **Request Changes** — Missing requirements, broken functionality, inadequate tests
- **Comments Only** — Minor suggestions, non-blocking observations

### Categorizing and Clustering Recommendations

When writing the `## Recommendations` section, read the NON-BLOCKING NOTES from all `report-*.md` files and group them by their category tags:

- `[do-now]` → `### Do now`
- `[quickfix]` → `### Quick-fixes`
- `[idea]` → `### Ideas`
- `[bug]` → `### Bugs`

If a note lacks a category tag, categorize by content: zero-risk non-logic edit → do-now, mechanical but logic-touching → quickfix, needs discussion/design → idea, broken behaviour → bug.

**Cluster within each subsection before numbering.** Collapse notes that share the same target file or the same theme into one item with sub-bullets, preserving each note's `file:line` and a `(Report N-M)` source tag. Same-file is the strongest signal; same-theme (e.g. "doc staleness", "test scaffolding") clusters across files. Never cluster across subsections — a `[quickfix]` and an `[idea]` about the same file stay separate. A single un-clustered note is just a one-line item carrying its `file:line`.

A clustered item:

```
4. `state_hydrate_test.go` — tighten test scaffolding
   - Extract `seedUnreadableSessionsJSON(t, dir)` helper; two permission tests share ~15 lines (lines 1517, 1576) (Report 2-1)
   - Lower-bound timing test could co-locate with the handler test (lines 1050, 1212) (Report 2-3)
```

Order subsections `### Do now`, `### Quick-fixes`, `### Ideas`, `### Bugs`. Only include subsections with at least one item. Number items sequentially across all subsections (do not reset per category). Omit the entire `## Recommendations` section if no notes survive.

### Commit and Continue

Commit: `review({work_unit}): complete review`

Your review feedback can be:
- Addressed by implementation (same or new session)
- Delegated to an agent for fixes
- Overridden by user ("ship it anyway")

You produce feedback. User decides what to do with it.

→ Return to caller.
