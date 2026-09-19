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
**Priority**: [Gap Analysis only — Critical | Important. Omit for Claims Verification and Input Review.]
**Affects**: [Which section(s) of the specification]

**Problem**:
[What is wrong, in the terms the reader cares about — the product, the end result. Not the analysis that found it.]

**Proposal**:
[Move `settled` — the call and what determined it, in a sentence or two; a call the record does not itself determine also names what leaned and the alternatives that fit. Omit for `choice` and `route`.]

**Options**:
[Move `choice` only — one line per option, "(recommended)" on at most one. Omit for `settled` and `route`.]

**Evidence**:
[Claims Verification only — the claim verbatim, the command, and its output; for a Source defect, which source document and section carries the claim. Omit for Input Review and Gap Analysis.]

**Current**:
[For findings that modify existing content (Enhancement, Duplication, Contradiction) — the existing specification content that will be modified. A Contradiction's Current holds only the passage being corrected; the colliding reading is named in the Problem with its section. Omit for New topic, Gap/Ambiguity, Source defect, and Unsourced decision findings.]

**Proposed Text**:
[The exact wording that lands in the specification — Move `settled`. Move `route` leaves it blank permanently: the fix belongs to the source record]

**Resolution**: Pending | Approved | Adjusted | Declined | Routed
**Notes**: [Any discussion notes or adjustments made]

---

### 2. [Next Finding]
...

## Observations

- [One line each — a point below the floor, or one minor enough that landing it would only be polish. Never walked, never counted.]
```

Some tracking files name the **Proposed Text** field **Proposed Change** or **Proposed Addition** — read all three as the same field. Older files write a `Skipped` resolution — read it as `Declined` — and a `decide` Move — read it as `settled`, the call made and its provenance named.

`Declined` records a finding left as-is with the reason in Notes: the outcome of the batch's Discuss or the choice menu's Comment exchange, a gap parked on the roadmap as beyond this specification's scope, or a point declined at dispose — a mechanism, boundary, or format detail that is the builder's, or a preference no side of which costs the user, so the specification states no rule for it and the reviewer should not have written it as a finding at all. It is never offered as a menu row — a decline without a stated reason is a skip whatever it is called.

## The Move

The move is what the reader has to do about the finding, and it alone decides how the finding is presented. Category describes what the reviewer found; it never picks the shape.

- **settled** — a source document states the answer; the record uniquely determines it (arithmetic from recorded numbers, a decided event whose consequence follows with no alternative); first principles over the decisions the record made whittle the fork to one answer the reviewer stands behind; or, among the answers that clear the finding's floor, several serve the user equally and the reviewer picks the most appropriate — a fork no side of which costs the user clears no floor and is not a finding. The finding carries the call and what determined it, and a call the record does not itself determine also names what leaned and the alternatives that also fit — the provenance of a decision the record never made. A fork with one live side — a side no informed user would choose — is `settled`, the derivation naming why the other side is dead.
- **choice** — real options exist and picking between them is the reader's — a verdict earned by searching, never a default: anything the record determines, and any fork first principles over it whittle to one answer, is `settled`; a point the sources are silent on that a measurement or sibling artifact pins is `route`. It holds only where the fork is what the product's user gets or how it behaves, nothing in the record breaks the tie, a side visibly costs the user, and the tie-break is product intent, which only the reader holds. A staged choice names what was searched and where the record ran out. The finding proposes nothing and presents the options; the stop holds even under `auto` — the search left the pick to the reader.
- **route** — the ground belongs to a source document, not this specification. It goes back to the document that owns it.

Settled findings render together: screens of at most five when the gate is on, each row the call and what leaned, landing on one confirmation, with any one of them expandable or pulled out for its own exchange; under `auto` the same screen documents what landed and never stops. A call the source document never made lands twice — first in that document, as a decision it never took, then in the specification — and records `Routed`, its Notes naming the document. A `choice` walks on its own after the batches, and its pick lands the same two places — the owning document first, then the specification — recording `Routed`.

**Builder's — not a finding.** A mechanism, boundary, byte, ordering, or format detail any competent implementer settles the same way, or one where either way leaves the user well served, is the planner's honest call. It is not written as a finding; at most it is an Observation.

`## Observations` holds what is below the finding floor — a point that names no failure for the product's user, and anything minor enough that landing it would only be polish. One line each, at the end of the tracking file. Observations are never walked, never counted, and never re-raised by a later gap-analysis pass; they ride only a file that carries findings.

The reviewer proposes the move; the orchestrator disposes every finding against the live session before anything renders, in both directions, on a derivation written into the finding — a `settled` call the session cannot itself stand behind becomes a `choice` and takes the bar; a `choice` below the bar becomes `settled` or `route`, or is declined outright — Resolution `Declined`, the Move left as staged — its derivation recorded (**[process-review-findings.md](process-review-findings.md)**). A choice that names no search is re-derived from scratch.

Two categories always take the `route` move, and their findings are never applied, adjusted, or presented at the gate — the orchestrator routes them per [resolve-source-incoherence.md](resolve-source-incoherence.md), and the resolution lands as `Routed`:

- **Source defect** — the specification faithfully carries a source claim or decision that is itself wrong: it fails direct measurement against the tree, or rests on ground the record has since superseded.
- **Unsourced decision** — the specification states a requirement or design decision that no source makes. The spec makes decisions clear; it never makes them.

## Workflow with Tracking Files

1. Complete your analysis and create the tracking file with all findings
2. Commit the tracking file — ensures it survives context refresh
3. Present the summary to the user (from the tracking file)
4. Dispose every finding, then work each move per **[process-review-findings.md](process-review-findings.md)**:
   - A finding the dispose declines — Resolution `Declined` with its reason, never presented
   - Every `settled` finding lands from the batch — screens of at most five when the gate is on, documented without a stop under `auto`
   - A `choice` is walked on its own after the batches: presented, discussed, the pick landed in the owning document first and then in the specification — Resolution `Routed`
   - A `route` finding goes back to the document that owns it — Resolution `Routed`, never presented at a gate
   - Update the tracking file: mark resolution, add notes
5. After all items resolved, record the flip: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} complete`

**Why tracking files**: If context refreshes mid-review, you can read the tracking file and continue where you left off. The tracking file shows which items are resolved and which remain.

→ Return to caller.
