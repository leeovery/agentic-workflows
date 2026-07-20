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

> *Output the next fenced block as a code block:*

```
{review_type} — {N} items found

1. {title} ({category})
   {1-2 line summary from the Details field}

2. ...
```

> *Output the next fenced block as a code block:*

```
Let's work through these one at a time, starting with #1.
```

→ Proceed to **B. Process One Item at a Time**.

---

## B. Process One Item at a Time

Work through each finding **sequentially**. For each finding: present it, show the proposed content, then route through the gate.

### Present Finding

Show the finding metadata, read directly from the tracking file:

> *Output the next fenced block as markdown (not a code block):*

```
**Finding {N} of {total}: {brief_title:(titlecase)}**

- **Source**: {from tracking file}
- **Category**: {from tracking file}
@if(review_type = Gap Analysis)
- **Priority**: Critical | Important | Minor
@endif
- **Affects**: {from tracking file}

**Details**: {from tracking file}
```

Then present the content based on **Category**:

**If Category is `Enhancement to existing topic` and Current field is present:**

Present the changes as a diff. Read Current and Proposed Addition from the tracking file. Show only the changed lines with 2 lines of context above and below:

> *Output the next fenced block as a code block:*

```
╭─ Finding {N}: {brief_title:(titlecase)} ──────────╮
```

> *Output the next fenced block as a code block:*

```diff
 {2 context lines above}
-{lines from Current}
+{lines from Proposed Addition}
 {2 context lines below}
```

> *Output the next fenced block as a code block:*

```
╰───────────────────────────────────────────────────╯
```

**Otherwise:**

> *Output the next fenced block as markdown (not a code block):*

```
**Proposed Addition**:
{from tracking file — the content to add to the specification}
```

**For potential gaps** (items not directly from source material): you're asking questions rather than proposing content. If the user wants to address a gap, discuss it, then present what you'd add for approval.

### Check Gate Mode

Check `finding_gate_mode` via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} finding_gate_mode`).

#### If `finding_gate_mode: auto`

1. Log the proposed content to the specification verbatim
2. Update the tracking file: set resolution to "Approved"
3. Commit

> *Output the next fenced block as a code block:*

```
Finding {N} of {total}: {brief_title:(titlecase)} — approved. Added to specification.
```

→ Return to **B. Process One Item at a Time** for the next pending finding, or proceed to **C. After All Findings Processed**.

#### If `finding_gate_mode: gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**Finding {N} of {total}: {brief_title:(titlecase)}**

- **`y`/`yes`** — Add to the specification verbatim
@if(Category is Enhancement to existing topic and Current field is present)
- **`v`/`view full`** — Show full Current and Proposed Addition content
@endif
- **`a`/`auto`** — Approve this and all remaining findings automatically
- **`s`/`skip`** — Leave as-is, move to next finding
- **Provide feedback** — Adjust before approving
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `view full`

Re-present the finding's **Current** and **Proposed Addition** content in full from the tracking file. Then re-present the approval menu.

→ Return to **B. Process One Item at a Time**.

#### If the user provides feedback

Incorporate feedback and update the tracking file with the revised content. Re-present the finding using the same presentation format (diff or full) as the original.

→ Return to **B. Process One Item at a Time**.

#### If `approved`

1. Log the content to the specification verbatim
2. Update the tracking file: set resolution to "Approved", add any discussion notes
3. Commit — ensures progress survives context refresh

> *Output the next fenced block as a code block:*

```
Finding {N} of {total}: {brief_title:(titlecase)} — added.
```

→ Return to **B. Process One Item at a Time** for the next pending finding, or proceed to **C. After All Findings Processed**.

#### If `auto`

1. Log the content (same as "If approved" above)
2. Update the tracking file: set resolution to "Approved"
3. Update `finding_gate_mode` to `auto` via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} finding_gate_mode auto`)
4. Commit
5. Process all remaining findings using the auto-mode flow above

→ After all processed, proceed to **C. After All Findings Processed**.

#### If `skipped`

1. Update the tracking file: set resolution to "Skipped", note the reason
2. Commit — ensures progress survives context refresh

> *Output the next fenced block as a code block:*

```
Finding {N} of {total}: {brief_title:(titlecase)} — skipped.
```

→ Return to **B. Process One Item at a Time** for the next pending finding, or proceed to **C. After All Findings Processed**.

---

## C. After All Findings Processed

1. **Mark the tracking file as complete** — Set `status: complete`.
2. **Commit** the tracking file and any specification changes.

> *Output the next fenced block as a code block:*

```
{review_type} complete — {N} findings processed.
```

→ Return to caller.
