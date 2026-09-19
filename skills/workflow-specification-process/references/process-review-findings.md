# Process Review Findings

*Reference for **[spec-review](spec-review.md)***

---

Process findings from a review phase interactively with the user. The analysis phase writes findings to a tracking file. Read the tracking file, dispose every finding, then work the three moves in turn.

**Review type**: `{review_type:[Claims Verification|Input Review|Gap Analysis]}` — set by the calling context (C, D, or E in spec-review.md); a caller that names a tracking file rather than a phase derives it, and the file's path, from the tracking stem (`review-claims-…` → Claims Verification, `review-input-…` → Input Review, `review-gap-analysis-…` → Gap Analysis).

Check if the tracking file exists at the expected path.

#### If no tracking file exists (no findings)

> *Output the next fenced block as a code block:*

```
{review_type} complete — no findings.
```

→ Return to caller.

#### If tracking file exists

Read the tracking file's `## Findings` section and count the pending findings there. `## Observations` is never read, walked, or counted.

→ Proceed to **A. Summary**.

---

## A. Summary

Write the summary payload to `.workflows/.cache/{work_unit}/specification/{topic}/findings-summary.json` with the Write tool — one item per finding from the tracking file:

```json
{"review_label": "{review_type}", "items": [{"title": "…", "tag": "…", "summary": "{1-2 line summary of the Problem}", "status": "…"}]}
```

- `tag` — the Category's token: `enhancement` (Enhancement to existing topic), `new-topic` (New topic), `gap` (Gap/Ambiguity), `contradiction` (Contradiction), `duplication` (Duplication), `source-defect` (Source defect), `unsourced-decision` (Unsourced decision). The tracking file keeps the full phrase.
- `status` — the finding's Resolution: `Approved`, `Adjusted`, or `Routed` → `approved`; `Declined` (older files write `Skipped` — read it as `Declined`) → `skipped`; `Pending` or unset → `pending`.

Render and emit the section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render findings-summary {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/findings-summary.json
```

→ Proceed to **B. Dispose Every Finding**.

---

## B. Dispose Every Finding

Every unresolved finding is disposed before anything renders — its Move settled against the bar and recorded in the tracking file. A finding whose Resolution is already `Approved`, `Adjusted`, `Declined`, or `Routed` (or legacy `Skipped`, read as `Declined`) was settled in an earlier sitting; never re-dispose, re-present, or re-apply it.

Take the unresolved findings one at a time. The tracking file proposed; this session decides — against the bar, with the context the reviewer lacked: user rulings this sitting, findings landed earlier in this walk, the specification's own decisions, ground that has moved, and the source document the finding names, read where the row's excerpt does not settle the point. Where a finding names no Move, or a Move outside this vocabulary, classify it from scratch against the same bar. Reclassification runs in both directions, always on a derivation written down.

**`route`** — the answer is owned by a source document rather than by this specification. Every Source defect and Unsourced decision is this move, and so is a point the sources are silent on that a measurement or a sibling artifact pins: the derivation belongs in the owning document, never in the specification alone.

**`settled`** — a source document states the answer; or the record uniquely determines it — arithmetic over recorded numbers, a decided event whose consequence follows with no alternative; or first principles over the decisions the record made whittle the fork to one answer this session stands behind; or, among the answers that clear the finding's floor, several serve the user equally and this session picks the most appropriate — a fork no side of which costs the user clears no floor, and is declined below. A call the record does not itself determine names what leaned and the alternatives that also fit — that sentence is the call's provenance, and a call that lands without it is a rule filed as the record's when it is this session's. A fork with one live side — a side no informed user would choose — is `settled` too, the derivation naming why the other side is dead, whatever the derivation is made of. The Proposal carries the derivation; Proposed Text, and Current where existing content changes, as the format requires.

**`choice`** — the pick is the user's. It stands only where every prong holds:

- **Product level** — the fork is what the product's user gets or how it behaves, never how the tree achieves it.
- **Irreducible** — no source, specification decision, measurement, sibling artifact, precedent, or constraint breaks the tie.
- **A side visibly costs the user** — a fork every side of which leaves the user well served is a preference, not a decision.
- **The tie-break is product intent** — appetite, or a fact only the user holds.

A `choice` names what was searched and where the record ran out. A `settled` call this session cannot itself stand behind is a `choice` and takes the same bar.

**Declined at dispose** — the fork is the builder's: a mechanism, boundary, byte, ordering, or format detail any competent implementer settles the same way, or a preference no side of which costs the user. The specification states no rule for it — Resolution `Declined` with the reason in Notes, the Move left as staged, announced in a line, committed, nothing rendered.

Three rules govern the evidence:

- The staged `(recommended)` marker is the reviewer's argument, never a ground.
- A choice that names no search is not a verdict: run the search yourself.
- A finding a gate exchange this sitting revised is disposed as it stands — the exchange was its disposal.

Record the disposal in the tracking file before anything renders. A staged move the bar confirms stands as written; where the disposal moved anything — the move, the derivation, or a search the staged choice never named — rewrite the row. To `settled`: Move rewritten, the Proposal written with the derivation — what determined it, or what leaned and the alternatives that also fit — the Options removed, Proposed Text, and Current where existing content changes, supplied as the format requires. To `choice`: Move rewritten, the Proposal and Proposed Text replaced with Options, the search named. To `route`: Move rewritten, Proposal, Options, and Proposed Text removed.

**If findings remain to dispose:**

→ Return to **B. Dispose Every Finding**.

**If every finding is disposed:**

→ Proceed to **C. The Settled Batch**.

---

## C. The Settled Batch

Every unresolved `settled` finding lands together, in screens of at most five — each a call this session stands behind, with what determined it or what leaned named beside it.

#### If no unresolved `settled` finding remains

→ Proceed to **D. The Choices**.

#### Otherwise

Write the payload to `.workflows/.cache/{work_unit}/specification/{topic}/finding-batch.json` with the Write tool — `{"lane": "settled", "items": [{"title": "…", "detail": "…"}], "remaining": N}`, one entry per unresolved `settled` finding up to five, `remaining` counting the lane's findings beyond this screen: `title` is the finding's brief title, `detail` one or two sentences carrying the call and what determined it or what leaned.

→ Proceed to **Present the Screen**.

### Present the Screen

Render the payload — the response carries the screen in the shape the gate mode earns:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding-batch {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/finding-batch.json
```

#### If the response carried `DISPLAY: finding batch auto-approved`

Emit the section verbatim at its marked instruction — it confirms the screen — then land each of the screen's findings per **Landing a Settled Finding**, in the order they read.

→ Return to **C. The Settled Batch**.

#### If the response carried `MENU: finding batch`

Emit the DISPLAY and MENU sections verbatim at their marked instructions.

**STOP.** Wait for user response.

**If `yes`:**

Land the screen's findings per **Landing a Settled Finding**, in the order they read, then confirm in one line — `All {N} documented.`

→ Return to **C. The Settled Batch**.

**If `auto`:**

Record the mode, then land the screen as `yes` does — every remaining screen documents itself:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} finding_gate_mode auto
```

→ Return to **C. The Settled Batch**.

**If discuss with a number:**

Land every other finding on the screen as `yes` does, then raise the named one in conversation.

- **The exchange settles it** — as staged, or with its content revised: where it changed, rewrite the row's Proposal and Proposed Text first, then land it as `yes` lands one, Resolution `Adjusted` in place of `Approved` where revised content lands in the specification alone, and confirm. → Return to **C. The Settled Batch**.
- **The exchange shows the pick is the reader's**: rewrite the Move to `choice` in the tracking file with its Options — the call as one, the alternatives it named as the others — and the search named; it walks in **D**. → Return to **C. The Settled Batch**.
- **The exchange concludes it should not land**: Resolution `Declined` with the reason in Notes, announced in a line, committed. → Return to **C. The Settled Batch**.
- **The exchange shows the gap needs work this specification cannot do in place**: → Proceed to **The Gap Door**.

**If ask (a number):**

Write that finding's payload per **The Finding Payload** with `move` = `settled`, then render it and emit each returned section verbatim at its marked instruction — the diff body as a ` ```diff ` fence:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/finding-current.json
```

A finding carrying whole proposed content returns its wording beneath the report. Expanding is not objecting — nothing resolved, so the screen re-renders unchanged.

→ Return to **C. The Settled Batch**.

### Landing a Settled Finding

An applied finding moves the ground a later finding stands on. Re-derive **both sides** of the finding's diff from the live document — what lands is the finding's change applied to the document as it stands, never the tracking file's stale copy, which would silently revert the earlier landing.

Before writing, check the proposed content against the one-home rule (**[specification-format.md](specification-format.md)**): revise a proposed restatement only where the copies would encode a rule whose divergence would be silent and change what gets built — restated context that reads well stands. Where the revision is owed, make it and update the tracking file. The same bar governs anything adjusted here: additive for missing ground, removal or in-place correction for wrong ground — never a correction note beside the old text, never a mention of review, cycles, or process. The document reads as authored fresh and correct.

**If the derivation is the record's own** — a source document states the answer, or the record determines it:

Apply the finding's Proposed Text to the specification exactly as staged, re-derived as above — a finding with a Current field replaces that content, never appends. Update the tracking file: Resolution `Approved`.

**If the call is this session's** — what leaned, with the alternatives beside it:

It is a decision the source document never made, so it lands there first. For a point the sources never decided, `doc` is whichever of this specification's **own sources** should own the missing decision:

→ Load **[resolve-source-incoherence.md](resolve-source-incoherence.md)** for **C. Landing a Resolution** and follow its instructions, with doc = `{the owning source's topic}`, lane = `review`, resolution = `{the call, carrying what leaned and the alternatives that also fit}`.

On return, land by what the reference did:

- **The decision landed** — apply the finding's Proposed Text to the specification exactly as staged, re-derived as above; Resolution `Routed` with Notes naming the document the decision landed in and the specification content re-aligned to it.
- **The resolution was queued** to a session holding the document — the specification's copy stays untouched; Resolution `Routed` with Notes naming the queue. The decision reaches the specification when the source re-concludes and this specification reconciles.
- **The landing returned `cancelled`** — the owning topic is closed and nothing landed. Raise it in conversation as **discuss** raises one — a stop owed whatever the gate mode, since a call with no document to own it is not one the specification makes alone — and dispose it by the exchange: the call stands → apply the Proposed Text to the specification, Resolution `Approved` with Notes naming why the owning document could not take it; the call falls → Resolution `Declined` with the reason.

When every finding on the screen is disposed, commit the specification and the tracking file together:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): {what the screen settled}" --topic specification/{topic}
```

### The Finding Payload

`render finding` serves two readers: a `settled` finding expanded from the batch, and a `choice` presented in **D**. Write the payload to `.workflows/.cache/{work_unit}/specification/{topic}/finding-current.json` with the Write tool, from the tracking file:

- `n`, `total`, `title` — the finding's position among the tracking file's findings in file order, the file's count, and the titlecased brief title.
- `meta` — `[label, value]` pairs: Source / Category / Affects, plus Priority for Gap Analysis findings.
- `move` — the finding's Move, as **B** disposed it: `settled` or `choice`.
- `category` — the Category's token (`enhancement`, `new-topic`, `gap`, `contradiction`, `duplication`). The source-lane tokens refuse at the surface — a backstop should **B** misclassify a route.
- `problem` — the Problem field, or the finding's substance restated in the terms the user cares about: the product, the end result. Never the analysis that found it, and never the specification's own wording read aloud.
- `proposal` — `settled` only: the Proposal field, or the call and what determined it, in a sentence or two.
- `options` — `choice` only: `[{"summary": "…", "recommended": true}, …]` from the Options field, at most one recommended. Where the finding names no options, they are yours to frame — one line each, and take a stance.
- `diff` and `content` — `settled` only; a `choice` proposes nothing and carries neither. Where a Current field is present: `diff` — `{"context_above": […], "current": […], "proposed": […], "context_below": […]}` with only the changed lines and 2 context lines each side (Proposed Text as the proposed lines). Where there is no Current and the Proposed Text is short — a sentence to a handful of lines — `diff` with `"current": []`, so the wording is visible. A whole proposed section: `content` — `{"label": "Proposed Text", "lines": […]}`, rendered beneath the report when the finding is expanded.

The user decides from the presentation alone — they have not read the specification. Where the tracking file's Problem, Proposal, or Options lean on a section reference, replace it with the substance that section holds; the `meta` Affects row is the one place a section number belongs.

---

## D. The Choices

#### If no unresolved `choice` finding remains

→ Proceed to **E. The Routes**.

#### Otherwise

Take the next one. Write its payload per **The Finding Payload** with `move` = `choice`, then render it and emit each returned section verbatim at its marked instruction — the stop holds whatever the gate mode, and over `auto` the menu opens on the engine's override line:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/finding-current.json
```

**STOP.** Wait for user response.

**If the user picks an option by number:**

The numbered options render recommended-first, so the number the user typed indexes that order, not the tracking file's. The pick is a decision the owning source document never made, so it lands there first — for a point the sources never decided, `doc` is whichever of this specification's **own sources** should own it:

→ Load **[resolve-source-incoherence.md](resolve-source-incoherence.md)** for **C. Landing a Resolution** and follow its instructions, with doc = `{the owning source's topic}`, lane = `review`, resolution = `{the picked side}`.

On return, land by what the reference did — the three outcomes **Landing a Settled Finding** names. Where the decision landed, compose the specification's content from the pick and write it, re-derived against the live document: the wording follows from the choice, so it lands without a second gate. Update the tracking file — Resolution `Routed`, Notes naming the document and the option chosen — and commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): {what the choice settled}" --topic specification/{topic}
```

> *Output the next fenced block as a code block:*

```
Finding {N} of {total}: {brief_title:(titlecase)} — {chosen option, one clause}.
```

→ Return to **D. The Choices**.

**If comment:**

Work the point through in conversation.

- **The exchange settles on a side**: land it as the numbered pick lands one. → Return to **D. The Choices**.
- **The choice stands**: re-present it. → Return to **D. The Choices**.
- **The exchange concludes it should not land**: Resolution `Declined` with the reason in Notes, announced in a line, committed. → Return to **D. The Choices**.
- **The exchange shows the gap needs work this specification cannot do in place**: → Proceed to **The Gap Door**.

### The Gap Door

Reached from the settled batch's discuss and the choice's comment alike: the finding's Problem is the gap.

→ Load **[resolve-source-incoherence.md](resolve-source-incoherence.md)** for **B. The Gap Exit** and follow its instructions, with doc = `{the owning source's topic}`, lane = `review`, taking the finding's Problem as the gap.

→ On return, dispose the finding by what the exit left: a roadmap park — Resolution `Declined` with the roadmap item in Notes, announced in a line, committed; a landing that delivered nothing — the exchange continues and ends in one of the caller's other outcomes. Then return to the section that came here — **C. The Settled Batch** or **D. The Choices**. Every other destination pauses the specification and routes the session out; the tracking entry stays `in-progress` and its remaining findings re-process at the next entry.

---

## E. The Routes

#### If no unresolved `route` finding remains

→ Proceed to **F. After All Findings Processed**.

#### Otherwise

A `route` finding — every Source defect and Unsourced decision, and any source-silent point a measurement or a sibling artifact pins — indicts a source, not the specification. It is never applied or adjusted here, and never rides `auto`:

→ Load **[resolve-source-incoherence.md](resolve-source-incoherence.md)** with doc = `{the owning source's topic}` (for a point the sources never decided, whichever of this specification's **own sources** should own the missing decision — the route never leaves the spec's sources; a spec cites no discussion it doesn't source), category = `{the finding's Category}` — `Unsourced decision` for a source-silent point the reviewer or **B** routed — lane = `review`, taking the finding's Problem as the material to classify.

On return, land the outcome by what actually happened there:

- **A resolution landed in the source document** (edited and reindexed): re-align the specification's affected content to it — the write lands the resolution the source now carries (the user's settlement, the measurement's, or the derivation the flow landed there), never content of this session's own invention, announced in one line. A re-aligned section invalidates any later finding's Current block that quotes it — re-derive from the file before applying that finding.
- **The record already settled the point** (no edit was needed): align the specification's affected content to the governing decision the record names, announced the same way.
- **The resolution was queued to a session holding the document** (nothing landed): leave the specification's copy alone — the delivery flagged the source's extractions stale, and this specification cannot conclude while its row for `{doc}` is `pending` or `stale`; the reconcile runs when the source re-concludes.
- **The gap was parked on the roadmap** (nothing landed anywhere and nothing reopened): the ground is beyond this specification's scope. Content the finding indicted as a decision no source made comes out of the specification — the capability is the roadmap's now, and the specification states no rule for it; a finding about an absence removes nothing.

Then update the tracking file — Resolution `Routed` with a note naming what landed or queued where, or `Declined` with the roadmap item the park named — and commit. (The gap exit's other destinations do not return: the specification pauses and the reference routes the session out; the tracking entry stays `in-progress` in the manifest, and its remaining findings re-process at the next entry.)

→ Return to **E. The Routes**.

---

## F. After All Findings Processed

1. **Mark the tracking file complete** — `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} complete`.
2. **Commit** the tracking file and any specification changes.

> *Output the next fenced block as a code block:*

```
{review_type} complete — {N} findings processed.
```

→ Return to caller.
