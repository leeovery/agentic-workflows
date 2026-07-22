# Process Review Findings

*Reference for **[spec-review](spec-review.md)***

---

Process findings from a review phase interactively with the user. The analysis phase writes findings to a tracking file. Read the tracking file and present each finding for approval.

**Review type**: `{review_type:[Input Review|Gap Analysis]}` — set by the calling context (C or D in spec-review.md).

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
{"review_label": "{review_type}", "items": [{"title": "…", "tag": "{category}", "summary": "{1-2 line summary from the Details field}"}]}
```

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render findings-summary {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/findings-summary.json
```

→ Proceed to **B. Process One Item at a Time**.

---

## B. Process One Item at a Time

Work through each finding **sequentially**. For each finding: present it, show the proposed content, then route through the gate.

### Present Finding

Write the finding payload to `.workflows/.cache/{work_unit}/specification/{topic}/finding-current.json` with the Write tool, from the tracking file:

- `n`, `total`, `title` — the finding's position and titlecased brief title.
- `meta` — `[label, value]` pairs: Source / Category / Affects, plus Priority for Gap Analysis findings.
- `details` — the Details field.
- If Category is `Enhancement to existing topic` and a Current field is present: `diff` — `{"context_above": […], "current": […], "proposed": […], "context_below": […]}` with only the changed lines and 2 context lines each side (Proposed Addition as the proposed lines).
- Otherwise: `content` — `{"label": "Proposed Addition", "lines": […]}` with the content to add.
- `apply_label`: `"Add to the specification verbatim"` · `applied_label`: `"approved. Added to specification."` · `feedback_hint`: `"Adjust before approving"`

Render, then emit each returned section verbatim at its marked instruction — the diff body as a ` ```diff ` fence between the frame rules:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding {work_unit}.specification.{topic} --file .workflows/.cache/{work_unit}/specification/{topic}/finding-current.json
```

**For potential gaps** (items not directly from source material): you're asking questions rather than proposing content. If the user wants to address a gap, discuss it, then present what you'd add for approval.

The response carries the finding presentation plus the surface for the current gate mode.

#### If the response carried `DISPLAY: finding auto-approved`

1. Log the proposed content to the specification verbatim
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

Re-present the finding's **Current** and **Proposed Addition** content in full from the tracking file. Then re-emit the `MENU: finding gate` section.

**STOP.** Wait for user response.

#### If the user provides feedback

Incorporate feedback and update the tracking file with the revised content. Rewrite the payload to match and re-render the finding.

→ Return to **B. Process One Item at a Time**.

#### If `yes`

1. Log the content to the specification verbatim
2. Update the tracking file: set resolution to "Approved", add any discussion notes
3. Commit — ensures progress survives context refresh

> *Output the next fenced block as a code block:*

```
Finding {N} of {total}: {brief_title:(titlecase)} — added.
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
5. Process all remaining findings using the auto-mode flow above

→ Proceed to **C. After All Findings Processed**.

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

1. **Mark the tracking file as complete** — Set `status: complete`.
2. **Commit** the tracking file and any specification changes.

> *Output the next fenced block as a code block:*

```
{review_type} complete — {N} findings processed.
```

→ Return to caller.
