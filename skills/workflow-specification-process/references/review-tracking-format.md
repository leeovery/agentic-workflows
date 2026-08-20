# Review Tracking Format

*Reference for **[spec-review](spec-review.md)***

---

Review tracking files capture analysis findings so work persists across context refresh.

## Location

Store tracking files in the specification directory (`.workflows/{work_unit}/specification/{topic}/`), cycle-numbered:
- `review-claims-tracking-c{N}.md` — Phase 1 (Claims Verification) findings for cycle N
- `review-input-tracking-c{N}.md` — Phase 2 (Input Review) findings for cycle N
- `review-gap-analysis-tracking-c{N}.md` — Phase 3 (Gap Analysis) findings for cycle N

Tracking files are **never deleted** — pure markdown, no frontmatter; previous cycles' files persist as analysis history. The orchestrator records each file's gate state in the manifest (`tracking.{file stem}`: `in-progress` at dispatch, `complete` when all findings are processed).

## Format

```markdown
# Review Tracking: [Topic Name] - [Phase]

## Findings

### 1. [Brief Title]

**Source**: [Where this came from — file/section reference, "Specification analysis" for Gap Analysis, or "Tree measurement — `{command}`" for Claims Verification]
**Category**: Enhancement to existing topic | New topic | Gap/Ambiguity | Duplication | Source defect | Unsourced decision
**Priority**: [Gap Analysis only — Critical | Important | Minor. Omit for Claims Verification and Input Review.]
**Affects**: [Which section(s) of the specification]

**Details**:
[Explanation of what was found and why it matters]

**Current**:
[For findings that modify existing content (Enhancement, Duplication) — the existing specification content that will be modified. Omit for New topic, Gap/Ambiguity, Source defect, and Unsourced decision findings.]

**Proposed Change**:
[What you would add or change in the specification — leave blank until discussed. Source defect and Unsourced decision findings leave it blank permanently: their fix belongs to the source record]

**Resolution**: Pending | Approved | Adjusted | Skipped | Routed
**Notes**: [Any discussion notes or adjustments made]

---

### 2. [Next Finding]
...
```

Some tracking files name the **Proposed Change** field **Proposed Addition** — read both as the same field.

Two categories indict a source rather than the specification, and their findings are never applied, adjusted, or skipped against the spec — the orchestrator routes them per [resolve-source-incoherence.md](resolve-source-incoherence.md), and the resolution lands as `Routed`:

- **Source defect** — the specification faithfully carries a source claim or decision that is itself wrong: it fails direct measurement against the tree, or rests on ground the record has since superseded.
- **Unsourced decision** — the specification states a requirement or design decision that no source makes. The spec makes decisions clear; it never makes them.

## Workflow with Tracking Files

1. Complete your analysis and create the tracking file with all findings
2. Commit the tracking file — ensures it survives context refresh
3. Present the summary to the user (from the tracking file)
4. Work through items one at a time:
   - A Source defect or Unsourced decision routes per **[process-review-findings.md](process-review-findings.md)** — Resolution `Routed`, never presented at the gate
   - Every other item: present, discuss and refine, get approval, log to specification
   - Update the tracking file: mark resolution, add notes
5. After all items resolved, record the flip: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} complete`

**Why tracking files**: If context refreshes mid-review, you can read the tracking file and continue where you left off. The tracking file shows which items are resolved and which remain. This is especially important when reviews surface 10-20 items that need individual discussion.

→ Return to caller.
