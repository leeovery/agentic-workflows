# Process Review Findings

*Reference for **[plan-review](plan-review.md)***

---

Process findings from a review agent interactively with the user. The agent writes findings — with full fix content — to a tracking file. Read the tracking file and present each finding for approval.

**Review type**: `{review_type:[traceability|integrity]}` — set by the calling context (C or D in plan-review.md).

**Commits in this file**: applying a finding writes through the format adapter, and the format's task storage may live outside the work unit. Commit with raw git — `git add -- .workflows/{work_unit} {format task storage paths}`, then `git commit` — never the scoped helper.

#### If `STATUS` is `clean`

> *Output the next fenced block as a code block:*

```
{Review type} review complete — no findings.
```

→ Return to caller.

#### If `STATUS` is `findings`

Read the tracking file at the path returned by the agent (`TRACKING_FILE`).

→ Proceed to **A. Summary**.

---

## A. Summary

Write the summary payload to `.workflows/.cache/{work_unit}/planning/{topic}/findings-summary.json` with the Write tool — one item per finding from the tracking file:

```json
{"review_label": "{Review type} Review", "items": [{"title": "…", "tag": "{type or severity} — {change_type}", "summary": "{1-2 line summary from the Details field}"}]}
```

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render findings-summary {work_unit}.planning.{topic} --file .workflows/.cache/{work_unit}/planning/{topic}/findings-summary.json
```

→ Proceed to **B. Process One Item at a Time**.

---

## B. Process One Item at a Time

Work through each finding **sequentially**. For each finding: present it, show the proposed fix, then route through the gate.

### Present Finding

Write the finding payload to `.workflows/.cache/{work_unit}/planning/{topic}/finding-current.json` with the Write tool, from the tracking file:

- `n`, `total`, `title` — the finding's position and Brief Title.
- `meta` — `[label, value]` pairs: for traceability, Type / Spec Reference / Plan Reference / Change Type; for integrity, Severity / Plan Reference / Category / Change Type.
- `details` — the Details field.
- For Change Type `update-task`, `add-to-task`, or `remove-from-task`: `diff` — `{"context_above": […], "current": […], "proposed": […], "context_below": […]}` with only the changed lines and 2 context lines each side.
- For Change Type `add-task`, `add-phase`, `remove-task`, or `remove-phase`: `content` — `{"label": "Proposed" | "Current", "lines": […]}` with the full content as written by the review agent.
- `apply_label`: `"Apply to the plan verbatim"` · `applied_label`: `"approved. Applied to plan."`

Render, then emit each returned section verbatim at its marked instruction — the diff body as a ` ```diff ` fence:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding {work_unit}.planning.{topic} --file .workflows/.cache/{work_unit}/planning/{topic}/finding-current.json
```

The response carries the finding presentation plus the surface for the current gate mode.

#### If the response carried `DISPLAY: finding auto-approved`

1. Apply the fix to the plan (use **Proposed** content exactly as in tracking file)
2. Keep `task_map` current in ONE call for the whole finding — for `add-task`/`add-phase`, batch every new mapping as field pairs in a single `set`; for `remove-task`/`remove-phase` (or a mixed change), write the finding's ops to `.workflows/.cache/{work_unit}/planning/{topic}/task-map-ops.json` with the Write tool and apply once:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} task_map.{internal_id}={external_id} task_map.{internal_id_2}={external_id_2}
   ```
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest apply {work_unit} --file .workflows/.cache/{work_unit}/planning/{topic}/task-map-ops.json
   ```
3. Update the tracking file: set resolution to "Fixed"
4. Commit the tracking file and plan changes
5. Emit the `DISPLAY: finding auto-approved` section now, per its marker.

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. After All Findings Processed**.

#### If the response carried `MENU: finding gate`

**STOP.** Wait for user response.

#### If `view full`

Re-present the finding's **Current** and **Proposed** content in full from the tracking file. Then re-emit the `MENU: finding gate` section.

**STOP.** Wait for user response.

#### If the user provides feedback

Incorporate feedback and update the tracking file with the revised content. Rewrite the payload to match and re-render the finding.

→ Return to **B. Process One Item at a Time**.

#### If `yes`

1. Apply the fix to the plan — use the **Proposed** content exactly as shown, using the output format adapter to determine how it's written. Do not modify content between approval and writing.
2. Keep `task_map` current — for `add-task`/`add-phase`, record each new internal ID → external ID mapping; for `remove-task`/`remove-phase`, delete each removed ID's entry (same commands as the auto flow above).
3. Update the tracking file: set resolution to "Fixed", add any discussion notes.
4. Commit the tracking file and any plan changes — ensures progress survives context refresh.
5. > *Output the next fenced block as a code block:*

   ```
   Finding {N} of {total}: {Brief Title} — fixed.
   ```

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. After All Findings Processed**.

#### If `auto`

1. Apply the fix and the `task_map` upkeep (same as "If `yes`" steps 1–2 above)
2. Update the tracking file: set resolution to "Fixed"
3. Update `finding_gate_mode` in the manifest:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} finding_gate_mode auto
   ```
4. Commit
5. Process all remaining findings using the auto-mode flow above

→ Proceed to **C. After All Findings Processed**.

#### If `skip`

1. Update the tracking file: set resolution to "Skipped", note the reason.
2. Commit the tracking file — ensures progress survives context refresh.
3. > *Output the next fenced block as a code block:*

   ```
   Finding {N} of {total}: {Brief Title} — skipped.
   ```

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. After All Findings Processed**.

---

## C. After All Findings Processed

1. **Mark the tracking file as complete** — Set `status: complete`.
2. **Commit** the tracking file and any plan changes.
3. > *Output the next fenced block as a code block:*

   ```
   {Review type} review complete — {N} findings processed.
   ```

→ Return to caller.
