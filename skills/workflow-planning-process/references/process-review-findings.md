# Process Review Findings

*Reference for **[plan-review](plan-review.md)***

---

Process findings from a review agent interactively with the user. The agent writes findings to a tracking file, each carrying the **move** it owes the user: `settled` (the record admits one defensible answer — the finding carries the fix and what determined it) or `choice` (real options exist and picking is the user's — the finding carries the options and proposes none). Read the tracking file and present each finding by its move.

**Review type**: `{review_type:[traceability|integrity]}` — set by the calling context (C or D in plan-review.md); a caller that names a tracking file rather than a phase derives it, and the file's path, from the tracking stem (`review-traceability-…` → traceability, `review-integrity-…` → integrity). Such a caller enters with the file in hand — read it and proceed to **A. Summary**; the `STATUS` branches below serve the agent-return callers.

**Commits in this file**: applying a finding writes through the format adapter; commit with `node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "<message>" --plan {topic}` — it stages the planning topic, the manifests, and the plan's declared storage.

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
{"review_label": "{Review type} Review", "items": [{"title": "…", "tag": "…", "summary": "{1-2 line summary of the Problem}", "status": "…"}]}
```

- `tag` — one short term: the Severity for an integrity finding; for a traceability finding, the Type's token — `missing` (Missing from plan), `hallucinated` (Hallucinated content), `incomplete` (Incomplete coverage). The tracking file keeps the full phrase.
- `status` — the finding's Resolution: `Fixed` → `approved`; `Declined` (older files write `Skipped` — read it as `Declined`) → `skipped`; `Pending` or unset → `pending`.

Render and emit the section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render findings-summary {work_unit}.planning.{topic} --file .workflows/.cache/{work_unit}/planning/{topic}/findings-summary.json
```

→ Proceed to **B. Process One Item at a Time**.

---

## B. Process One Item at a Time

Work through each unresolved finding **sequentially** — a finding whose Resolution is already `Fixed` or `Declined` (or legacy `Skipped`, read as `Declined`) was settled in an earlier sitting; never re-present or re-apply it.

**If no unresolved finding remains** — every row already settled, whether this sitting or an earlier one:

→ Proceed to **C. After All Findings Processed**.

Read the next unresolved finding's **Move** before presenting it — it decides the shape. Where the finding names none, classify it and record it in the tracking file: exactly one defensible answer in the specification or the record → `settled`; real options between which only the user can pick → `choice`.

Then confirm that move against the live session. A `settled` finding whose stated derivation no longer holds, or whose fix you cannot yourself stand behind, is a `choice`: update the Move, replace its fix with options, and present it that way. Reclassification only ever moves toward the user; a `choice` is never demoted to `settled` to save a stop.

→ Proceed to **Present Finding**.

### Present Finding

An applied finding moves the ground a later finding stands on. Re-derive **both sides** of a later finding's diff from the live plan content — what lands is the finding's change applied to the plan as it stands, never the tracking file's stale copy, which would silently revert the earlier landing.

Write the finding payload to `.workflows/.cache/{work_unit}/planning/{topic}/finding-current.json` with the Write tool, from the tracking file:

- `n`, `total`, `title` — the finding's position and Brief Title.
- `meta` — `[label, value]` pairs: for traceability, Type / Spec Reference / Plan Reference / Change Type; for integrity, Severity / Plan Reference / Category / Change Type.
- `move` — the finding's Move, as **B** settled it: `settled` or `choice`.
- `problem` — what is wrong, in the terms the user cares about: what the plan would build wrong, or fail to build. Never the analysis that found it.
- `proposal` — `settled` only: the fix and what determined it.
- `options` — `choice` only: `[{"summary": "…", "recommended": true}, …]`, at most one recommended. Where the finding names no options, they are yours to frame — one line each, and take a stance.
- `diff` and `content` — `settled` only; a `choice` proposes nothing and carries neither. Change Type `update-task`, `add-to-task`, or `remove-from-task`: `diff` — `{"context_above": […], "current": […], "proposed": […], "context_below": […]}` with only the changed lines and 2 context lines each side. Change Type `add-task` or `add-phase`: `content` — `{"label": "Proposed Text", "lines": […]}` with the full content as written by the review agent. Change Type `remove-task` or `remove-phase`: `content` — `{"label": "Current", "lines": […]}` with the content being removed. Either `content` is held for `v/view`, never rendered at the gate.
- `apply_label`: `"Apply to the plan verbatim"` · `applied_label`: `"approved. Applied to plan."`

Render, then emit each returned section verbatim at its marked instruction — the diff body as a ` ```diff ` fence:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding {work_unit}.planning.{topic} --file .workflows/.cache/{work_unit}/planning/{topic}/finding-current.json
```

The response carries the finding presentation plus the surface for its move and the current gate mode.

#### If the response carried `DISPLAY: finding auto-approved`

1. Apply the fix to the plan — the finding's change re-derived against the live plan content, from the **Proposed Text** field (older tracking files name it **Proposed** — read both as the same field); for `remove-task`/`remove-phase` the fix is removing the **Current** content
2. Keep `task_map` current in ONE call for the whole finding — for `add-task`/`add-phase`, batch every new mapping as field pairs in a single `set`; for `remove-task`/`remove-phase` (or a mixed change), write the finding's ops — `{"op": "delete", "path": "{work_unit}.planning.{topic}", "field": "task_map.{internal_id}"}` per removal, `{"op": "set", …}` per addition — to `.workflows/.cache/{work_unit}/planning/{topic}/task-map-ops.json` with the Write tool and apply once:
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

#### If the response carried `MENU: finding gate` or `MENU: finding choice`

**STOP.** Wait for user response.

#### If `view`

Re-render with `--view full` and emit both returned sections verbatim at their marked instructions:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding {work_unit}.planning.{topic} --file .workflows/.cache/{work_unit}/planning/{topic}/finding-current.json --view full
```

**STOP.** Wait for user response.

#### If the user picks an option by number

The numbered options render recommended-first, so the number the user typed indexes that order, not the tracking file's.

1. Apply the chosen option to the plan — the fix follows from the choice, so it lands without a second gate — with the `task_map` upkeep of the auto flow above.
2. Update the tracking file: set resolution to "Fixed", record which option was chosen in Notes.
3. Commit the tracking file and any plan changes.
4. > *Output the next fenced block as a code block:*

   ```
   Finding {N} of {total}: {Brief Title} — {chosen option, one clause}.
   ```

**If pending findings remain:**

→ Return to **B. Process One Item at a Time**.

**If all findings are processed:**

→ Proceed to **C. After All Findings Processed**.

#### If comment (the choice menu's prompt option)

Work the point through in conversation. Where it settles on an option, land it as the numbered-pick branch does — the plan write, the `task_map` upkeep, the tracking file, the commit — and continue. Where it concludes the finding should not land at all, set Resolution `Declined` with the reason in Notes, announce it in a line, and commit.

→ Return to **B. Process One Item at a Time**.

#### If discuss (the settled gate's prompt option)

Work the point through in conversation — a challenge, an adjustment, or a decline all start here.

- **The exchange revises the content**: update the tracking file with the revised content — **B** re-presents the finding from the updated file, once.
- **The exchange ends in agreement to apply**: land it as the `yes` branch does.
- **The exchange concludes the finding should not land** — it is wrong, or real but not worth the ink: set Resolution `Declined` with the reason in Notes, announce it in a line, and commit. Declined is never offered as a menu row — it exists only here, as the outcome of this exchange.

→ Return to **B. Process One Item at a Time**.

#### If `yes`

1. Apply the fix to the plan — the finding's change exactly as presented, from the **Proposed Text** field (older tracking files name it **Proposed** — read both as the same field); for `remove-task`/`remove-phase` the fix is removing the **Current** content. Write through the output format adapter, and do not modify content between approval and writing.
2. Keep `task_map` current in ONE call for the whole finding (same commands as the auto flow above).
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
5. Process each remaining finding from **B** — the mode change removes the approval stops for settled fixes, never the per-finding pass: a `choice` still stops, and every finding is still rendered

→ Return to **B. Process One Item at a Time**.

---

## C. After All Findings Processed

1. **Mark the tracking file complete** — `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} tracking.{file stem} complete`.
2. **Commit** the tracking file and any plan changes.
3. > *Output the next fenced block as a code block:*

   ```
   {Review type} review complete — {N} findings processed.
   ```

→ Return to caller.
