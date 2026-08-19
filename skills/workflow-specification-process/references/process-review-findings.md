# Process Review Findings

*Reference for **[spec-review](spec-review.md)***

---

Process findings from a review phase interactively with the user. The analysis phase writes findings to a tracking file. Read the tracking file and present each finding for approval.

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
{"review_label": "{review_type}", "items": [{"title": "…", "tag": "…", "summary": "{1-2 line summary from the Details field}", "status": "…"}]}
```

- `tag` — the Category's token: `enhancement` (Enhancement to existing topic), `new-topic` (New topic), `gap` (Gap/Ambiguity), `duplication` (Duplication), `source-defect` (Source defect), `unsourced-decision` (Unsourced decision). The tracking file keeps the full phrase.
- `status` — the finding's Resolution: `Approved`, `Adjusted`, or `Routed` → `approved`, `Skipped` → `skipped`, `Pending` or unset → `pending`.

Render and emit the section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render findings-summary {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/findings-summary.json
```

→ Proceed to **B. Process One Item at a Time**.

---

## B. Process One Item at a Time

Work through each unresolved finding **sequentially** — a finding whose Resolution is already `Approved`, `Adjusted`, `Routed`, or `Skipped` was settled in an earlier sitting; never re-present or re-apply it.

**If no unresolved finding remains** — every row already settled, whether this sitting or an earlier one:

→ Proceed to **C. After All Findings Processed**.

**If the next unresolved finding's Category is `Source defect` or `Unsourced decision`:**

→ Proceed to **Route Source-Lane Findings**.

**Otherwise:**

→ Proceed to **Present Finding**.

### Route Source-Lane Findings

A finding whose Category is **Source defect** or **Unsourced decision** indicts a source, not the specification — it is never applied, adjusted, or skipped here, and never rides `auto`. Instead of presenting it:

→ Load **[resolve-source-incoherence.md](resolve-source-incoherence.md)** with doc = `{the owning source's topic}` (for an unsourced decision, whichever of this specification's **own sources** should own the missing decision — the route never leaves the spec's sources; a spec cites no discussion it doesn't source), taking the finding's Details as the material to classify.

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

Before presenting, check the finding's proposed content against the one-home rule (**[specification-format.md](specification-format.md)**): where it restates a fact that already has a home in the specification, revise it to reference the home and update the tracking file. The same bar governs anything adjusted here: additive for missing ground, removal or in-place correction for wrong ground — never a correction note beside the old text, never a mention of review, cycles, or process. The document reads as authored fresh and correct.

Write the finding payload to `.workflows/.cache/{work_unit}/specification/{topic}/finding-current.json` with the Write tool, from the tracking file:

- `n`, `total`, `title` — the finding's position and titlecased brief title.
- `meta` — `[label, value]` pairs: Source / Category / Affects, plus Priority for Gap Analysis findings.
- `category` — the Category's token (`enhancement`, `new-topic`, `gap`, `duplication`). A `gap` finding is a question, not a correction — the surface renders its gate even when the manifest holds `auto`.
- `details` — the Details field.
- If a Current field is present: `diff` — `{"context_above": […], "current": […], "proposed": […], "context_below": […]}` with only the changed lines and 2 context lines each side (Proposed Change as the proposed lines).
- Otherwise: `content` — `{"label": "Proposed Change", "lines": […]}` with the proposed content.
- `apply_label`: `"Apply to the specification verbatim"` · `applied_label`: `"approved. Applied to specification."` · `feedback_hint`: `"Adjust before approving"`

Render, then emit each returned section verbatim at its marked instruction — the diff body as a ` ```diff ` fence:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/finding-current.json
```

**For potential gaps** (items not directly from source material): you're asking questions rather than proposing content. If the user wants to address a gap, discuss it, then present what you'd add for approval.

The response carries the finding presentation plus the surface for the current gate mode.

#### If the response carried `DISPLAY: finding auto-approved`

1. Log the proposed content to the specification verbatim — a finding with a Current field replaces that content, never appends
2. Update the tracking file: set resolution to "Approved"
3. Commit
4. Emit the `DISPLAY: finding auto-approved` section now, per its marker.

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. After All Findings Processed**.

#### If the response carried `MENU: finding gate`

**STOP.** Wait for user response.

#### If `view full`

Re-present the finding's **Current** and **Proposed Change** content in full from the tracking file. Then re-emit the `MENU: finding gate` section.

**STOP.** Wait for user response.

#### If the user provides feedback

Incorporate feedback and update the tracking file with the revised content. Rewrite the payload to match and re-render the finding.

→ Return to **B. Process One Item at a Time**.

#### If `yes`

1. Log the content to the specification verbatim — a finding with a Current field replaces that content, never appends
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
5. Process each remaining finding from **B** — the mode change removes the approval stops, never the per-finding pass: source-lane findings still route, and every other finding is still rendered, the surface deciding its gate per finding

→ Return to **B. Process One Item at a Time**.

#### If `skip`

1. Update the tracking file: set resolution to "Skipped", note the reason
2. Commit — ensures progress survives context refresh

> *Output the next fenced block as a code block:*

```
Finding {N} of {total}: {brief_title:(titlecase)} — skipped.
```

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. After All Findings Processed**.

---

## C. After All Findings Processed

1. **Mark the tracking file complete** — `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} complete`.
2. **Commit** the tracking file and any specification changes.

> *Output the next fenced block as a code block:*

```
{review_type} complete — {N} findings processed.
```

→ Return to caller.
