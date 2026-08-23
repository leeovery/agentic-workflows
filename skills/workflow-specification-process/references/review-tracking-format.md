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
**Category**: Enhancement to existing topic | New topic | Gap/Ambiguity | Contradiction | Duplication | Source defect | Unsourced decision
**Move**: settled | choice | route
**Priority**: [Gap Analysis only — Critical | Important | Minor. Omit for Claims Verification and Input Review.]
**Affects**: [Which section(s) of the specification]

**Problem**:
[What is wrong, in the terms the reader cares about — the product, the end result. Not the analysis that found it.]

**Proposal**:
[Move `settled` only — the call and what determined it, in a sentence or two. Omit for `choice` and `route`.]

**Options**:
[Move `choice` only — one line per option, "(recommended)" on at most one. Omit for `settled` and `route`.]

**Evidence**:
[Claims Verification only — the claim verbatim, the command, and its output; for a Source defect, which source document and section carries the claim. Omit for Input Review and Gap Analysis.]

**Current**:
[For findings that modify existing content (Enhancement, Duplication, Contradiction) — the existing specification content that will be modified. A Contradiction's Current holds only the passage being corrected; the colliding reading is named in the Problem with its section. Omit for New topic, Gap/Ambiguity, Source defect, and Unsourced decision findings.]

**Proposed Text**:
[The exact wording that lands in the specification — Move `settled` only. Move `route` leaves it blank permanently: the fix belongs to the source record]

**Resolution**: Pending | Approved | Adjusted | Declined | Routed
**Notes**: [Any discussion notes or adjustments made]

---

### 2. [Next Finding]
...
```

Some tracking files name the **Proposed Text** field **Proposed Change** or **Proposed Addition** — read all three as the same field. Older files write a `Skipped` resolution — read it as `Declined`.

`Declined` records a finding discussed with the user and left as-is, with the reason in Notes. It is never offered as a menu row: it exists only as the outcome of the gate's Discuss exchange — a decline without a stated reason is a skip whatever it is called.

## The Move

The move is what the reader has to do about the finding, and it alone decides how the finding is presented. Category describes what the reviewer found; it never picks the shape.

- **settled** — the record admits exactly one defensible answer. The finding carries the call and what determined it; `auto` applies it without a stop.
- **choice** — real options exist and picking between them is the reader's. The finding proposes nothing and presents the options; the stop holds even under `auto`, because `auto` means "don't pause me for what you can decide", never "decide what you can't".
- **route** — nobody here can answer it. It goes back to the document that owns the ground.

A finding whose stated derivation does not hold, or that you cannot yourself stand behind, is a `choice` — never a `settled` call made on the reader's behalf. Reclassification only ever moves toward the reader.

Two categories always take the `route` move, and their findings are never applied, adjusted, or presented at the gate — the orchestrator routes them per [resolve-source-incoherence.md](resolve-source-incoherence.md), and the resolution lands as `Routed`:

- **Source defect** — the specification faithfully carries a source claim or decision that is itself wrong: it fails direct measurement against the tree, or rests on ground the record has since superseded.
- **Unsourced decision** — the specification states a requirement or design decision that no source makes. The spec makes decisions clear; it never makes them.

## Workflow with Tracking Files

1. Complete your analysis and create the tracking file with all findings
2. Commit the tracking file — ensures it survives context refresh
3. Present the summary to the user (from the tracking file)
4. Work through items one at a time:
   - A `route` finding routes per **[process-review-findings.md](process-review-findings.md)** — Resolution `Routed`, never presented at the gate
   - Every other item: present it by its move, discuss and refine, get approval, log to specification
   - Update the tracking file: mark resolution, add notes
5. After all items resolved, record the flip: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} complete`

**Why tracking files**: If context refreshes mid-review, you can read the tracking file and continue where you left off. The tracking file shows which items are resolved and which remain. This is especially important when reviews surface 10-20 items that need individual discussion.

→ Return to caller.
