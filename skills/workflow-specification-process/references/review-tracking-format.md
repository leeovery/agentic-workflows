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
**Move**: settled | decide | choice | route
**Priority**: [Gap Analysis only — Critical | Important. Omit for Claims Verification and Input Review.]
**Affects**: [Which section(s) of the specification]

**Problem**:
[What is wrong, in the terms the reader cares about — the product, the end result. Not the analysis that found it.]

**Proposal**:
[Moves `settled` and `decide` — the call and what determined it, in a sentence or two; a `decide` also names the alternatives that fit the record. Omit for `choice` and `route`.]

**Options**:
[Move `choice` only — one line per option, "(recommended)" on at most one. Omit for `settled`, `decide`, and `route`.]

**Evidence**:
[Claims Verification only — the claim verbatim, the command, and its output; for a Source defect, which source document and section carries the claim. Omit for Input Review and Gap Analysis.]

**Current**:
[For findings that modify existing content (Enhancement, Duplication, Contradiction) — the existing specification content that will be modified. A Contradiction's Current holds only the passage being corrected; the colliding reading is named in the Problem with its section. Omit for New topic, Gap/Ambiguity, Source defect, and Unsourced decision findings.]

**Proposed Text**:
[The exact wording that lands in the specification — Moves `settled` and `decide`. Move `route` leaves it blank permanently: the fix belongs to the source record]

**Resolution**: Pending | Approved | Adjusted | Declined | Routed
**Notes**: [Any discussion notes or adjustments made]

---

### 2. [Next Finding]
...

## Observations

- [One line each — a point below the floor, or one minor enough that landing it would only be polish. Never walked, never counted.]
```

Some tracking files name the **Proposed Text** field **Proposed Change** or **Proposed Addition** — read all three as the same field. Older files write a `Skipped` resolution — read it as `Declined`.

`Declined` records a finding left as-is with the reason in Notes: the outcome of the gate's Discuss or Comment exchange, or a point declined at dispose — a mechanism, boundary, or format detail that is the builder's, or a preference no side of which costs the user, so the specification states no rule for it and the reviewer should not have written it as a finding at all. It is never offered as a menu row — a decline without a stated reason is a skip whatever it is called.

## The Move

The move is what the reader has to do about the finding, and it alone decides how the finding is presented. Category describes what the reviewer found; it never picks the shape.

- **settled** — a source document states the answer, or the record uniquely determines it — arithmetic from recorded numbers, a decided event whose consequence follows with no alternative. Where more than one answer is consistent with the record, nobody has decided: analogy to a neighbouring rule, precedent, the treatment a sibling case already takes, and first principles are consistency, not determination. The finding carries the call and what determined it; `auto` applies it without a stop.
- **decide** — the fork is product-level — what the product's user gets or how it behaves — and more than one answer fits the record. The reviewer makes the call, names what leaned, and names the alternatives that also fit; the finding carries a Proposal and Proposed Text as a `settled` one does. It never rides `auto`.
- **choice** — real options exist and picking between them is the reader's — a verdict earned by searching, never a default: anything the sources determine is `settled`, a point they are silent on that a measurement or sibling artifact pins is `route`, and a product-level fork the record leaves open that the reviewer can stand behind is `decide`. It holds only where the fork is what the product's user gets or how it behaves, nothing in the record breaks the tie, a side visibly costs the user, and the tie-break is product intent, which only the reader holds. A staged choice names what was searched and where the record ran out. The finding proposes nothing and presents the options; the stop holds even under `auto` — the search left the pick to the reader.
- **route** — the ground belongs to a source document, not this specification. It goes back to the document that owns it.

A `decide` is presented in a batch: a screen of at most five, each row the call and what leaned, scanned for a veto, with any one of them expandable or pulled out for its own exchange. What survives lands twice — in the source document that owns the decision, as a decision that document never made, and then in the specification. A decision nobody made is never applied out of the user's sight, and `auto` never covers one. One that lands records as `Routed`, its Notes naming the document the decision went to and the specification content re-aligned to it.

**Builder's — not a finding.** A mechanism, boundary, byte, ordering, or format detail any competent implementer settles the same way, or one where either way leaves the user well served, is the planner's honest call. It is not written as a finding; at most it is an Observation.

`## Observations` holds what is below the finding floor — a point that names no failure for the product's user, and anything minor enough that landing it would only be polish. One line each, at the end of the tracking file. Observations are never walked, never counted, and never re-raised by a later gap-analysis pass; they ride only a file that carries findings.

The reviewer proposes the move; the orchestrator disposes it against the live session before the finding renders, in both directions, on a derivation written into the finding — a `settled` call the record does not determine becomes a `decide`, and one the session cannot itself stand behind becomes a `choice` and takes the bar; a `choice` below the bar becomes `decide`, `settled`, or `route`, or is declined outright — Resolution `Declined`, the Move left as staged — its derivation recorded (**[process-review-findings.md](process-review-findings.md)**). A choice that names no search is re-derived from scratch.

Two categories always take the `route` move, and their findings are never applied, adjusted, or presented at the gate — the orchestrator routes them per [resolve-source-incoherence.md](resolve-source-incoherence.md), and the resolution lands as `Routed`:

- **Source defect** — the specification faithfully carries a source claim or decision that is itself wrong: it fails direct measurement against the tree, or rests on ground the record has since superseded.
- **Unsourced decision** — the specification states a requirement or design decision that no source makes. The spec makes decisions clear; it never makes them.

## Workflow with Tracking Files

1. Complete your analysis and create the tracking file with all findings
2. Commit the tracking file — ensures it survives context refresh
3. Present the summary to the user (from the tracking file)
4. Work through items one at a time:
   - A `route` finding routes per **[process-review-findings.md](process-review-findings.md)** — Resolution `Routed`, never presented at the gate
   - A finding the dispose declines — Resolution `Declined` with its reason, never presented at the gate
   - A `decide` finding is held for the batch at **C** of **[process-review-findings.md](process-review-findings.md)** — never presented one at a time
   - Every other item: present it by its move, discuss and refine, get approval, log to specification
   - Update the tracking file: mark resolution, add notes
5. After all items resolved, record the flip: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} complete`

**Why tracking files**: If context refreshes mid-review, you can read the tracking file and continue where you left off. The tracking file shows which items are resolved and which remain.

→ Return to caller.
