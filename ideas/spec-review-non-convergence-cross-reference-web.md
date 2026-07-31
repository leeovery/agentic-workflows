# Spec Review Doesn't Converge When the Spec Becomes a Cross-Reference Web

> **Status: problem statement + loose suggestions. Not investigated.** Written from one live run where the failure was diagnosed but the fix was not designed or tested. Everything under *What I'd Change* is a starting hypothesis, not a recommendation to implement as-is.

## The Problem

Specification review cycles normally converge — high on cycle 1, into the 3–5 range by cycle 2–3, then 2, 1, 0. On the portal `theming-system` feature it did not. It plateaued at 7–10 gap-analysis findings per cycle and stayed there for **nine consecutive cycles**, with no recurrences and no sign of stopping.

The cause is not spec size, reviewer thoroughness, or finding-acceptance rate. It is that **the specification was authored as a densely cross-referenced web, and the review process is structurally biased toward making that worse on every cycle.**

## Observed Pattern

Findings per cycle on `theming-system` (portal), input review / gap analysis:

| Cycle | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Input | 9 | 3 | 4 | 2 | 4 | 3 | 2 | 4 | 2 | 3 | 4 |
| Gap | 20 | 18 | 14 | 9 | 11 | 9 | 8 | 7 | 9 | 7 | 10 |

**Input review converged fine** — 2–4 from cycle 2 onward, and by cycle 9+ its findings were "restore the evidence behind a decision", not missing decisions. The source was exhausted. **Gap analysis never converged.**

The comparator that rules out size as the cause — same repo, same process:

| | `theming-system` | `built-in-session-resurrection` |
|---|---|---|
| Spec size | 1,915 lines | 1,558 lines (82%) |
| Cycles to converge | 11+ (did not) | **3** (21 → 12 → 2) |
| Findings total | **162** | 47 |
| Internal `§N.N` cross-references | **569** | **0** |

Acceptance rate is not the difference either — every prior run in the repo approved ~100% of findings too (`built-in-session-resurrection` 47/0, `cli-verb-surface-redesign` 24/0, `session-scrollback-preview` 36/0). The theming run was 162/0. Same discipline, different outcome.

`built-in-session-resurrection` is written as **self-contained sections**: each states what is built in its area and makes no claims about another section's content. Editing one cannot falsify another. `theming-system` is written as a **web** — ~0.3 claims-about-other-sections per line.

### The dominant finding class was self-inflicted

Reclassifying the late-cycle findings, the majority were **restatements that drifted**, not genuine specification gaps:

- The accent contrast floor stated in two sections → they disagreed
- The `●` badge's source stated in two sections → they disagreed
- The enumeration seam stated in two sections → one said "commitment", the other "possibility"
- A reason class defined in one section, applied with different semantics in two others
- A count restating its own list (said four, listed five)
- A summary restating its own table (said "14 taken directly", table showed 13)

Cross-references never broke. **Restatements did.** Cycle 11 found five items created by cycle 10's own edits.

### The loop

1. A fact gets stated in two places — nothing in the workflow forbids it.
2. Later edits land on one place. They drift.
3. Gap analysis reports a **contradiction** (it hunts contradictions; it does not hunt duplication).
4. The finding frame offers only **`Proposed Addition`**.
5. The author adds reconciling prose plus cross-references, instead of collapsing to one statement.
6. The fact now has three homes and more inbound edges. Return to 2.

The process detects the *symptom* and its fix frame guarantees the *cause* gets worse.

## Where the Workflow Encourages It

| File | Current state |
|---|---|
| `specification-format.md` | *"Structure is **flexible** — organize around phases and subject matter, not rigid sections."* That is the **entire** structural guidance. Nothing on section self-containment, single-source-of-truth for a fact, or what a cross-reference is for. |
| `review-tracking-format.md` | The content field is **`Proposed Addition`**. Categories are `Enhancement to existing topic \| New topic \| Gap/Ambiguity` — all three additive framings. There is no revision or consolidation category. |
| `process-review-findings.md` | `apply_label: "Add to the specification verbatim"`, `applied_label: "approved. Added to specification."` The author works inside an add-only frame on every finding (162 times, in this run). |
| `workflow-specification-review-gap-analysis.md` | Hunts *"Contradictions between sections"*, *"Requirements that conflict"*, *"Terms used inconsistently across sections"*. **Duplication is not on the list.** Neither review agent can propose a removal — the words *remove*, *delete*, *consolidate*, *trim* do not appear in either agent file. |

Nothing in the process can make a specification smaller.

## The Distinction That Seems to Matter

There appear to be two kinds of cross-reference, and conflating them is what went wrong:

- **Load-bearing** — points at a fact's single home *instead of restating it*. Reduces coupling: one place to edit. `"The reason vocabulary is §6.2."` Net **negative** surface.
- **Narrative** — points at another section to justify, compare, or show consistency. Restates nothing, buys nothing, adds an edge. `"Flagged here in the same way §7.7's check gates the built-in set and §8.4's ordering carries §5.4's safety property."` Net **positive** surface, zero information.

The theming spec's 569 references were heavily the second kind, *and* it duplicated facts anyway — worst of both. Note that the good kind is exactly what the maintainer described wanting: state a thing once, point at it from the other five places rather than repeating it.

## What I'd Change

**All loose. Needs investigation — in particular, validate against more prior runs before touching anything.**

1. **`specification-format.md` — add a one-home rule.** Replace or supplement *"structure is flexible"* with something like: *every value, rule and enumeration has exactly one section that states it; every other mention points there and never restates. Reference to avoid restating; never reference to justify, compare, or note consistency.* This is the single highest-leverage change if the diagnosis holds.

2. **`review-tracking-format.md` — let a finding shrink the document.** Add `Proposed Revision` beside `Proposed Addition`, and a `Duplication/Consolidation` category alongside the three existing ones.

3. **`process-review-findings.md` — neutralise the frame.** `"Apply to the specification"` rather than `"Add to the specification"`. Small, but it is the frame the author works inside on every single finding.

4. **`workflow-specification-review-gap-analysis.md` — hunt duplication, not just contradiction.** Something like: *"Is any fact, value, rule or enumeration stated in more than one place? Name the home and the restatements."* This catches the cause before drift turns it into a contradiction. Possibly also: *"Does any cross-reference justify rather than point at a fact's home?"*

5. **Optional — a growth signal.** Report net line delta per review cycle. A spec that only grows after cycle 2 may be the smell. Unclear whether this is worth the machinery; listed for consideration.

## Open Questions

- **Does the diagnosis generalise, or is this one bad spec?** Only one run is in evidence. Check other repos' specs for `§N.N` density vs cycle count. If dense-reference specs converge fine elsewhere, the cause is something else (or additive: density × edit-rate × size).
- **Is numbered-section format itself a risk factor?** `built-in-session-resurrection` (0 refs, converged in 3) uses prose headings; `spectrum-tui-design` (189 refs over 650 lines — similar *density* to theming) took more cycles than the flat-prose specs but did settle at 1–2. Numbered sections make referencing cheap, which may be the enabling condition rather than the cause.
- **Where is the line between load-bearing and narrative?** The distinction is clear in the extreme cases and fuzzy in the middle. Needs a rule an agent can apply, not just a principle. Worth testing a draft rule against the theming spec's 569 refs and seeing what fraction it correctly classifies.
- **Should the one-home rule apply during construction, review, or both?** Construction is where the web is built; review is where it compounds. Probably both, but the construction-side rule is untested and could over-constrain a genuinely interconnected subject.
- **Does a consolidation pass need to be a first-class phase step?** This run needed one and had nowhere to put it — the only available action was another review cycle, which was the wrong tool. A `consolidate` action at the review loop's re-loop prompt (alongside `reanalyse` / `proceed`) may be the missing affordance.
- **Is the input/gap split worth surfacing separately in the convergence diagnostic?** The merged per-cycle total hid the signal for several cycles: input had clearly converged while gap had not, and that divergence *is* the diagnosis. `convergence-analysis.md` currently reports one figure.

## Relevant Files

- `skills/workflow-specification-process/references/specification-format.md` — the "structure is flexible" line; primary edit site for suggestion 1
- `skills/workflow-specification-process/references/review-tracking-format.md:27,37` — `Category` values and the `Proposed Addition` field
- `skills/workflow-specification-process/references/process-review-findings.md:60-62` — `apply_label` / `applied_label`
- `skills/workflow-specification-process/references/spec-review.md` — the re-loop prompt; where a `consolidate` action would go
- `agents/workflow-specification-review-gap-analysis.md:29,59,63-64` — the contradiction hunt list
- `skills/workflow-shared/references/convergence-analysis.md` — the merged-total diagnostic
- Evidence (portal repo): `.workflows/theming-system/specification/theming-system/` (22 tracking files, 11 cycles) vs `.workflows/built-in-session-resurrection/specification/built-in-session-resurrection/` (5 tracking files, 3 cycles)

## Implementation Notes

- The failure is **silent and expensive**: nothing errors, every finding is real on its own terms, and each cycle looks productive. Only the aggregate shape reveals it. Whatever ships should make the shape visible early rather than relying on someone noticing at cycle 11.
- Zero recurrences across 162 findings — every fix held. This is not a quality problem with the review agents; they were doing their job correctly on a document whose structure guaranteed more work.
- The maintainer's read, worth recording: this has not happened before across hundreds of runs, which is what makes it diagnosable — the process is otherwise reliable, so the deviation is informative rather than noise.
- Related in spirit to [[review-finding-grouping]] (both are about the review output's shape amplifying downstream work) and [[editing-historical-phase-artefacts]] (both touch how artefacts change after they are written).
