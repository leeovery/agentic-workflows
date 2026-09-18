# Process Review Findings

*Reference for **[spec-review](spec-review.md)***

---

Process findings from a review phase interactively with the user. The analysis phase writes findings to a tracking file. Read the tracking file and present each finding by the move it carries.

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

→ Proceed to **B. Process One Item at a Time**.

---

## B. Process One Item at a Time

Work through each unresolved finding **sequentially** — a finding whose Resolution is already `Approved`, `Adjusted`, `Declined`, or `Routed` (or legacy `Skipped`, read as `Declined`) was settled in an earlier sitting; never re-present or re-apply it. A finding whose Move reads `decide` is held for the batch at **C** — passed over here, never disposed twice.

**If no finding remains to dispose** — every row settled, whether this sitting or an earlier one, or held for the decide batch:

→ Proceed to **C. The Decide Batch**.

Read the next unresolved finding's **Move** — it decides everything that follows. Where the finding names none, classify it and record it in the tracking file: the answer owned by a source document rather than by this specification → `route` — a point the sources are silent on that a measurement or a sibling artifact pins is this move too (an Unsourced decision: the derivation belongs in the owning document, never the spec alone); a source document states the answer, or the record uniquely determines it — arithmetic over recorded numbers, a decided event whose consequence follows with no alternative → `settled`, the derivation carried as the Proposal's reasoning; a product-level fork more than one answer fits → `decide`, the call made, what leaned named, and the alternatives that also fit named beside it; real options the search genuinely leaves to the user → `choice`, naming what was searched.

Then dispose the move. The tracking file proposed; this session decides — against the bar, with the context the reviewer lacked: user rulings this sitting, findings landed earlier in this walk, the specification's own decisions, ground that has moved, and the source document the finding names, read where the row's excerpt does not settle the point. Reclassification runs in both directions, always on a derivation written down; a finding this sitting's gate exchange revised is presented as it stands — the exchange was its disposal.

A `settled` finding holds only where the record determines the answer. Where more than one answer is consistent with the record — the derivation an analogy to a neighbouring rule, a precedent, the treatment a sibling case already takes, or first principles — nobody has decided: the move becomes `decide` where the fork is product-level, and the finding is declined where the fork is the builder's — a mechanism, boundary, byte, ordering, or format detail any competent implementer settles the same way, or one where either way leaves the user well served. A `settled` call this session cannot itself stand behind at all is a `choice` and takes the bar like any other. A `choice` stands only when every prong holds:

- **Product level** — the fork is what the product's user gets or how it behaves, never how the tree achieves it.
- **Irreducible** — no source, specification decision, measurement, sibling artifact, precedent, or constraint breaks the tie.
- **A side visibly costs the user** — a fork every side of which leaves the user well served is a preference, not a decision.
- **The tie-break is product intent** — appetite, or a fact only the user holds.

Three rules govern the evidence:

- The staged `(recommended)` marker is the reviewer's argument, never a ground.
- A fork with one live side — a side no informed user would choose — is settled.
- A choice that names no search is not a verdict: run the search yourself.

A fork that clears every prong stands as a `choice` — the specification never invents product intent. Below the bar the move is rewritten: `decide` where the fork is product-level, more than one answer fits the record, and this session can make the call and name what leaned; `settled` where the record determines exactly one answer (a point a source delegated to the specification included); `route` where the sources are silent and a measurement or a sibling artifact pins the answer. Where the fork is the builder's — a mechanism, boundary, byte, ordering, or format detail any competent implementer settles the same way, or a preference no side of which costs the user — the finding is declined: Resolution `Declined` with the reason in Notes, the Move left as staged, announced in a line, committed, nothing rendered.

Where the disposal moved anything — the move, the derivation, or a search the staged choice never named — record it in the tracking file before anything renders. To `settled`: Move rewritten, the Proposal written with the derivation naming what decided it, the Options removed, Proposed Text — and Current where existing content changes — supplied as the format requires. To `decide`: Move rewritten, the Proposal written with the call, what leaned, and the alternatives that also fit the record, the Options removed, Proposed Text — and Current where existing content changes — supplied as the format requires. To `choice`: Move rewritten, the Proposal and Proposed Text replaced with Options, the search named. To `route`: Move rewritten, Proposal, Options, and Proposed Text removed.

**If the disposal declined the finding:**

→ Return to **B. Process One Item at a Time**.

**If the finding's Move is `decide`:**

The disposal is recorded and the finding is held — nothing is presented for it here; **C** takes it with the rest of the lane.

→ Return to **B. Process One Item at a Time**.

**If the next unresolved finding's Move is `route`:**

→ Proceed to **Route Source-Lane Findings**.

**Otherwise:**

→ Proceed to **Present Finding**.

### Route Source-Lane Findings

A `route` finding — every Source defect and Unsourced decision, and any source-silent point a measurement or a sibling artifact pins, whether the reviewer staged it or **B** disposed it — indicts a source, not the specification. It is never applied or adjusted here, and never rides `auto`. Instead of presenting it:

→ Load **[resolve-source-incoherence.md](resolve-source-incoherence.md)** with doc = `{the owning source's topic}` (for a point the sources never decided, whichever of this specification's **own sources** should own the missing decision — the route never leaves the spec's sources; a spec cites no discussion it doesn't source), category = `{the finding's Category}` — `Unsourced decision` for a source-silent point the reviewer or **B** routed — lane = `review`, taking the finding's Problem as the material to classify.

On return, land the outcome by what actually happened there:

- **A resolution landed in the source document** (edited and reindexed): re-align the specification's affected content to it — the write lands the resolution the source now carries (the user's settlement, the measurement's, or the derivation the flow landed there), never content of this session's own invention, announced in one line. A re-aligned section invalidates any later finding's Current block that quotes it — re-derive from the file before presenting that finding.
- **The record already settled the point** (no edit was needed): align the specification's affected content to the governing decision the record names, announced the same way.
- **The resolution was queued to a session holding the document** (nothing landed): leave the specification's copy alone — the delivery flagged the source's extractions stale, and this specification cannot conclude while its row for `{doc}` is `pending` or `stale`; the reconcile runs when the source re-concludes.

Then update the tracking file — Resolution `Routed`, a note naming what landed (or queued) where — and commit. (The gap exit does not return: the specification pauses and the reference routes the session out; the tracking entry stays `in-progress` in the manifest, and its remaining findings re-process at the next entry.)

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. The Decide Batch**.

### Present Finding

An applied finding moves the ground a later finding stands on. Re-derive **both sides** of a later finding's diff from the live document — what lands is the finding's change applied to the document as it stands, never the tracking file's stale copy, which would silently revert the earlier landing.

Before presenting, check the finding's proposed content against the one-home rule (**[specification-format.md](specification-format.md)**): revise a proposed restatement only where the copies would encode a rule whose divergence would be silent and change what gets built — restated context that reads well stands. Where the revision is owed, make it and update the tracking file. The same bar governs anything adjusted here: additive for missing ground, removal or in-place correction for wrong ground — never a correction note beside the old text, never a mention of review, cycles, or process. The document reads as authored fresh and correct.

Write the finding payload to `.workflows/.cache/{work_unit}/specification/{topic}/finding-current.json` with the Write tool, from the tracking file:

- `n`, `total`, `title` — the finding's position and titlecased brief title.
- `meta` — `[label, value]` pairs: Source / Category / Affects, plus Priority for Gap Analysis findings.
- `move` — the finding's Move, as **B** disposed it: `settled` or `choice`.
- `category` — the Category's token (`enhancement`, `new-topic`, `gap`, `contradiction`, `duplication`). The source-lane tokens refuse at the surface — a backstop should **B** misclassify a route.
- `problem` — the Problem field, or the finding's substance restated in the terms the user cares about: the product, the end result. Never the analysis that found it, and never the specification's own wording read aloud.
- `proposal` — `settled` only: the Proposal field, or the call and what determined it, in a sentence or two.
- `options` — `choice` only: `[{"summary": "…", "recommended": true}, …]` from the Options field, at most one recommended. Where the finding names no options, they are yours to frame — one line each, and take a stance.
- `diff` and `content` — `settled` only; a `choice` proposes nothing and carries neither. Where a Current field is present: `diff` — `{"context_above": […], "current": […], "proposed": […], "context_below": […]}` with only the changed lines and 2 context lines each side (Proposed Text as the proposed lines). Where there is no Current and the Proposed Text is short — a sentence to a handful of lines — `diff` with `"current": []`, so the wording is visible at the gate. A whole proposed section: `content` — `{"label": "Proposed Text", "lines": […]}`, held for `v/view`, never rendered at the gate.
- `apply_label`: `"Apply to the specification verbatim"` · `applied_label`: `"approved. Applied to specification."`

The user decides from the presentation alone — they have not read the specification. Where the tracking file's Problem, Proposal, or Options lean on a section reference, replace it with the substance that section holds; the `meta` Affects row is the one place a section number belongs.

Render, then emit each returned section verbatim at its marked instruction — the diff body as a ` ```diff ` fence:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/finding-current.json
```

The response carries the finding presentation plus the surface for its move and the current gate mode.

#### If the response carried `DISPLAY: finding auto-approved`

1. Log the finding's change to the specification exactly as the re-derived diff states it — a finding with a Current field replaces that content, never appends
2. Update the tracking file: set resolution to "Approved"
3. Commit
4. Emit the `DISPLAY: finding auto-approved` section now, per its marker.

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. The Decide Batch**.

#### If the response carried `MENU: finding gate` or `MENU: finding choice`

**STOP.** Wait for user response.

#### If `view`

Re-render with `--view full` and emit both returned sections verbatim at their marked instructions:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/finding-current.json --view full
```

**STOP.** Wait for user response.

#### If the user picks an option by number

The numbered options render recommended-first, so the number the user typed indexes that order, not the tracking file's.

1. Write the chosen option into the specification — the wording follows from the choice, so it lands without a second gate
2. Update the tracking file: set resolution to "Approved", record which option was chosen in Notes
3. Commit

> *Output the next fenced block as a code block:*

```
Finding {N} of {total}: {brief_title:(titlecase)} — {chosen option, one clause}.
```

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. The Decide Batch**.

#### If comment (the choice menu's prompt option)

Work the point through in conversation. Where it settles on an option, land it as the numbered-pick branch does — the specification write, the tracking file, the commit — and continue. Where it concludes the finding should not land at all, set Resolution `Declined` with the reason in Notes, announce it in a line, and commit. Where the exchange shows the answer belongs to a source document rather than to this specification, treat the finding as `route` and load **[resolve-source-incoherence.md](resolve-source-incoherence.md)** as **Route Source-Lane Findings** prescribes.

→ Return to **B. Process One Item at a Time**.

#### If discuss (the settled gate's prompt option)

Work the point through in conversation — a challenge, an adjustment, or a decline all start here.

- **The exchange revises the content**: update the tracking file with the revised content — **B** re-presents the finding from the updated file, once.
- **The exchange ends in agreement to apply**: land it as the `yes` branch does.
- **The exchange concludes the finding should not land** — it is wrong, or real but not worth the ink: set Resolution `Declined` with the reason in Notes, announce it in a line, and commit. Declined is never offered as a menu row — it lands only as the outcome of an exchange, this one or the choice menu's Comment, and at **B**'s dispose of a point the specification has no rule for.

→ Return to **B. Process One Item at a Time**.

#### If `yes`

1. Log the finding's change to the specification exactly as the presented diff states it — a finding with a Current field replaces that content, never appends
2. Update the tracking file: set resolution to "Approved", add any discussion notes
3. Commit — ensures progress survives context refresh

> *Output the next fenced block as a code block:*

```
Finding {N} of {total}: {brief_title:(titlecase)} — applied.
```

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. The Decide Batch**.

#### If `auto`

1. Log the content (same as "If `yes`" above)
2. Update the tracking file: set resolution to "Approved"
3. Update `finding_gate_mode` to `auto` via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} finding_gate_mode auto`)
4. Commit
5. Process each remaining finding from **B** — the mode change removes the approval stops for settled calls, never the per-finding pass: `route` findings still route, a finding **B** declines renders nothing, a `decide` is still held for the batch at **C**, which stops under `auto` too, a `choice` that stands at **B**'s dispose still stops, and every finding **B** presents is still rendered

→ Return to **B. Process One Item at a Time**.

---

## C. The Decide Batch

Every finding **B** held — each one whose Move reads `decide` — lands together with the rest, in screens of at most five. Each is a product-level call this session made where more than one answer fit the record: the screen is a scan and a veto, never a deliberation.

#### If every finding is resolved

→ Proceed to **D. After All Findings Processed**.

#### If a finding is unresolved and none carries the `decide` move

The batch sent one back to the walk.

→ Return to **B. Process One Item at a Time**.

#### Otherwise

Write the payload to `.workflows/.cache/{work_unit}/specification/{topic}/finding-batch.json` with the Write tool — `{"lane": "decide", "items": [{"title": "…", "detail": "…"}], "remaining": N}`, one entry per pending `decide` finding up to five, `remaining` counting the lane's findings beyond this screen: `title` is the finding's brief title, `detail` one or two sentences carrying the call and what leaned.

Read the gate mode where it is not current in context (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} finding_gate_mode`). **This stop overrides `auto`** — where the mode holds `auto`, open with the announcement verbatim, as a line above the batch — **Auto is on — stopping anyway:** this is one of the calls auto never makes for you.

Render, then emit the returned DISPLAY and MENU sections verbatim at their marked instructions:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding-batch {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/finding-batch.json
```

**STOP.** Wait for user response.

**If `yes`:**

Land the screen's findings one at a time, in the order they read. Each call is a decision its source document never made, so it lands there first — for a point the sources never decided, `doc` is whichever of this specification's **own sources** should own the missing decision:

→ Load **[resolve-source-incoherence.md](resolve-source-incoherence.md)** for **C. Landing a Resolution** and follow its instructions, with doc = `{the owning source's topic}`, lane = `review`, resolution = `{the call, carrying what leaned and the alternatives that also fit}`.

On return, apply the finding's Proposed Text to the specification exactly as staged, re-derived against the live document as **Present Finding** prescribes. Set Resolution `Routed` with Notes naming the document the decision landed in and the specification content re-aligned to it, then commit the specification and the tracking file:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): {what the call settled}" --topic specification/{topic}
```

A document another session holds takes the reference's own held-doc branch — the resolution queues, the specification's copy stays untouched, and the Notes name the queue; follow where it returns.

When the screen has landed, confirm in one line — `All {N} documented.`

→ Return to **C. The Decide Batch**.

**If discuss with a number:**

Work that finding through in conversation.

- **The exchange settles it**: land it as the `yes` branch lands one — the source document, the specification, Resolution `Routed`, the commit.
- **The exchange shows the pick is the reader's**: rewrite the Move to `choice` in the tracking file with its Options and the search named, and leave it — the walk raises it once the lane empties.
- **The exchange concludes it should not land**: Resolution `Declined` with the reason in Notes, announced in a line, committed.

The finding has left the lane whichever way it went, and the batch re-renders without it.

→ Return to **C. The Decide Batch**.

**If ask (a number):**

Expand that finding in prose — its Problem, its Proposal, and its Proposed Text. Expanding is not objecting; the screen stands.

→ Return to **C. The Decide Batch**.

---

## D. After All Findings Processed

1. **Mark the tracking file complete** — `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} complete`.
2. **Commit** the tracking file and any specification changes.

> *Output the next fenced block as a code block:*

```
{review_type} complete — {N} findings processed.
```

→ Return to caller.
