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

Read the tracking file and count pending findings.

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

Work through each unresolved finding **sequentially** — a finding whose Resolution is already `Approved`, `Adjusted`, `Declined`, or `Routed` (or legacy `Skipped`, read as `Declined`) was settled in an earlier sitting; never re-present or re-apply it.

**If no unresolved finding remains** — every row already settled, whether this sitting or an earlier one:

→ Proceed to **C. After All Findings Processed**.

Read the next unresolved finding's **Move** — it decides everything that follows. Where the finding names none, classify it and record it in the tracking file: the answer owned by a source document rather than by this specification → `route`; exactly one defensible answer in the record → `settled`; real options between which only the user can pick → `choice`.

Then confirm that move against the live session. A `settled` finding whose stated derivation no longer holds — a decision made since the tracking file was written, ground the session has moved — or whose call you cannot yourself stand behind, is a `choice`: update the Move, replace its Proposal with Options, and present it that way. Reclassification only ever moves toward the user; a `choice` is never demoted to `settled` to save a stop.

**If the next unresolved finding's Move is `route`:**

→ Proceed to **Route Source-Lane Findings**.

**Otherwise:**

→ Proceed to **Present Finding**.

### Route Source-Lane Findings

A `route` finding — Category **Source defect** or **Unsourced decision** — indicts a source, not the specification. It is never applied or adjusted here, and never rides `auto`. Instead of presenting it:

→ Load **[resolve-source-incoherence.md](resolve-source-incoherence.md)** with doc = `{the owning source's topic}` (for an unsourced decision, whichever of this specification's **own sources** should own the missing decision — the route never leaves the spec's sources; a spec cites no discussion it doesn't source), category = `{the finding's Category}`, lane = `review`, taking the finding's Problem as the material to classify.

On return, land the outcome by what actually happened there:

- **A resolution landed in the source document** (edited and reindexed): re-align the specification's affected content to it — the write lands the resolution the user just settled (or the measurement made), never new content, announced in one line. A re-aligned section invalidates any later finding's Current block that quotes it — re-derive from the file before presenting that finding.
- **The record already settled the point** (no edit was needed): align the specification's affected content to the governing decision the record names, announced the same way.
- **The resolution was queued to a session holding the document** (nothing landed): leave the specification's copy alone — the delivery flagged the source's extractions stale, and this specification cannot conclude while its row for `{doc}` is `pending` or `stale`; the reconcile runs when the source re-concludes.

Then update the tracking file — Resolution `Routed`, a note naming what landed (or queued) where — and commit. (The gap exit does not return: the specification pauses and the reference routes the session out; the tracking entry stays `in-progress` in the manifest, and its remaining findings re-process at the next entry.)

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. After All Findings Processed**.

### Present Finding

An applied finding moves the ground a later finding stands on. Re-derive **both sides** of a later finding's diff from the live document — what lands is the finding's change applied to the document as it stands, never the tracking file's stale copy, which would silently revert the earlier landing.

Before presenting, check the finding's proposed content against the one-home rule (**[specification-format.md](specification-format.md)**): where it restates a fact that already has a home in the specification, revise it to reference the home and update the tracking file. The same bar governs anything adjusted here: additive for missing ground, removal or in-place correction for wrong ground — never a correction note beside the old text, never a mention of review, cycles, or process. The document reads as authored fresh and correct.

Write the finding payload to `.workflows/.cache/{work_unit}/specification/{topic}/finding-current.json` with the Write tool, from the tracking file:

- `n`, `total`, `title` — the finding's position and titlecased brief title.
- `meta` — `[label, value]` pairs: Source / Category / Affects, plus Priority for Gap Analysis findings.
- `move` — the finding's Move, as **B** settled it: `settled` or `choice`.
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

→ Proceed to **C. After All Findings Processed**.

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

→ Proceed to **C. After All Findings Processed**.

#### If comment (the choice menu's prompt option)

Work the point through in conversation. Where it settles on an option, land it as the numbered-pick branch does — the specification write, the tracking file, the commit — and continue. Where it concludes the finding should not land at all, set Resolution `Declined` with the reason in Notes, announce it in a line, and commit. Where the exchange shows the answer belongs to a source document rather than to this specification, treat the finding as `route` and load **[resolve-source-incoherence.md](resolve-source-incoherence.md)** as **Route Source-Lane Findings** prescribes.

→ Return to **B. Process One Item at a Time**.

#### If discuss (the settled gate's prompt option)

Work the point through in conversation — a challenge, an adjustment, or a decline all start here.

- **The exchange revises the content**: update the tracking file with the revised content — **B** re-presents the finding from the updated file, once.
- **The exchange ends in agreement to apply**: land it as the `yes` branch does.
- **The exchange concludes the finding should not land** — it is wrong, or real but not worth the ink: set Resolution `Declined` with the reason in Notes, announce it in a line, and commit. Declined is never offered as a menu row — it exists only here, as the outcome of this exchange.

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

→ Proceed to **C. After All Findings Processed**.

#### If `auto`

1. Log the content (same as "If `yes`" above)
2. Update the tracking file: set resolution to "Approved"
3. Update `finding_gate_mode` to `auto` via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} finding_gate_mode auto`)
4. Commit
5. Process each remaining finding from **B** — the mode change removes the approval stops for settled calls, never the per-finding pass: `route` findings still route, a `choice` still stops, and every finding is still rendered

→ Return to **B. Process One Item at a Time**.

---

## C. After All Findings Processed

1. **Mark the tracking file complete** — `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} complete`.
2. **Commit** the tracking file and any specification changes.

> *Output the next fenced block as a code block:*

```
{review_type} complete — {N} findings processed.
```

→ Return to caller.
