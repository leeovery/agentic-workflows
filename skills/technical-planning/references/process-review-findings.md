# Process Review Findings

*Reference for **[plan-review](plan-review.md)***

---

Process findings from a review agent interactively with the user. The agent writes findings — with full fix content — to a tracking file. Read the tracking file and present each finding for approval.

**Review type**: `{review_type:[traceability|integrity]}` — set by the calling context (B or C in plan-review.md).

#### If `STATUS` is `clean`

> *Output the next fenced block as a code block:*

```
{Review type} review complete — no findings.
```

→ Return to **[plan-review.md](plan-review.md)** for the next phase.

#### If `STATUS` is `findings`

Read the tracking file at the path returned by the agent (`TRACKING_FILE`).

→ Proceed to **A. Summary**.

---

## A. Summary

> *Output the next fenced block as a code block:*

```
{Review type} Review — {N} items found

1. {title} ({type or severity}) — {change_type}
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

Work through each finding **sequentially**. For each finding: present it, show the proposed fix, then route through the gate.

### Present Finding

Show the finding with its full fix content, read directly from the tracking file.

> *Output the next fenced block as markdown (not a code block):*

```
**Finding {N} of {total}: {Brief Title}**

@if(review_type = traceability)
- **Type**: Missing from plan | Hallucinated content | Incomplete coverage
- **Spec Reference**: {from tracking file}
- **Plan Reference**: {from tracking file}
- **Change Type**: {from tracking file}
@else
- **Severity**: Critical | Important | Minor
- **Plan Reference**: {from tracking file}
- **Category**: {from tracking file}
- **Change Type**: {from tracking file}
@endif

**Details**: {from tracking file}

**Current**:
{from tracking file — the existing plan content}

**Proposed**:
{from tracking file — the replacement content}
```

### Check Gate Mode

Check `finding_gate_mode` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.finding_gate_mode
```

#### If `finding_gate_mode: auto`

1. Apply the fix to the plan (use **Proposed** content exactly as in tracking file)
2. Update the tracking file: set resolution to "Fixed"
3. Commit the tracking file and plan changes

> *Output the next fenced block as a code block:*

```
Finding {N} of {total}: {Brief Title} — approved. Applied to plan.
```

→ Present the next pending finding, or proceed to **C. After All Findings Processed**.

#### If `finding_gate_mode: gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**Finding {N} of {total}: {Brief Title}**
- **`y`/`yes`** — Approved. Apply to the plan verbatim.
- **`a`/`auto`** — Approve this and all remaining findings automatically
- **`s`/`skip`** — Leave as-is, move to next finding.
- **Or provide feedback** to adjust the fix.
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If the user provides feedback

Incorporate feedback and re-present the proposed fix **in full**. Update the tracking file with the revised content. Then ask the same choice again. Repeat until approved or skipped.

#### If `approved`

1. Apply the fix to the plan — use the **Proposed** content exactly as shown, using the output format adapter to determine how it's written. Do not modify content between approval and writing.
2. Update the tracking file: set resolution to "Fixed", add any discussion notes.
3. Commit the tracking file and any plan changes — ensures progress survives context refresh.
4. > *Output the next fenced block as a code block:*

   ```
   Finding {N} of {total}: {Brief Title} — fixed.
   ```

→ Present the next pending finding, or proceed to **C. After All Findings Processed**.

#### If `auto`

1. Apply the fix (same as "If approved" above)
2. Update the tracking file: set resolution to "Fixed"
3. Update `finding_gate_mode` in the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.finding_gate_mode auto
   ```
4. Commit
5. Process all remaining findings using the auto-mode flow above

→ After all processed, proceed to **C. After All Findings Processed**.

#### If `skipped`

1. Update the tracking file: set resolution to "Skipped", note the reason.
2. Commit the tracking file — ensures progress survives context refresh.
3. > *Output the next fenced block as a code block:*

   ```
   Finding {N} of {total}: {Brief Title} — skipped.
   ```

→ Present the next pending finding, or proceed to **C. After All Findings Processed**.

---

## C. After All Findings Processed

1. **Mark the tracking file as complete** — Set `status: complete`.
2. **Commit** the tracking file and any plan changes.
3. > *Output the next fenced block as a code block:*

   ```
   {Review type} review complete — {N} findings processed.
   ```

→ Return to **[plan-review.md](plan-review.md)** for the next phase.
