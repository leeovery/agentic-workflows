# Specification Display and Menu

*Reference for **[epic-display-and-menu](epic-display-and-menu.md)***

---

The `s` row: how the epic's completed discussions group into specifications — the grouping analysis, the groupings and specifications menus, the unify. A pick stores its specification as `{topic}` and returns to the caller, which confirms it and hands it off; the single-discussion path, which picks nothing, confirms its own before it returns. A back, a decline, a block or a deferral returns to the caller for **A. State Display and Menu**.

## A. Route on the Scenario

Read the scenario:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs spec-scenario {work_unit}
```

The output is one **DATA** section — `scenario`, counts, `cache_status`, `discussions_checksum`, the single-discussion context where it applies, and the discussion and specification detail. Reason from it; never display or restate it.

#### If `scenario` is `blocked-no-discussions`, `blocked-none-completed`, or `blocked-discussions-open`

The discussion record does not support a specification yet — none exist, none are completed, or discussions are still open and the specification waits on the settled record. Render the snapshot:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs spec-view {work_unit}
```

Emit the TITLE section, then the DISPLAY section, each verbatim per its marker.

→ Return to caller for **A. State Display and Menu**.

#### If `scenario` is `single`

→ Proceed to **B. Single Discussion**.

#### If `scenario` is `analyze`

→ Proceed to **C. Analyze Prompt**.

#### If `scenario` is `groupings`

→ Proceed to **F. Groupings Menu**.

#### If `scenario` is `specs-menu`

→ Proceed to **G. Specifications Menu**.

---

## B. Single Discussion

One completed discussion, so no selection menu is needed — the snapshot names the specification it proceeds with:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs spec-view {work_unit}
```

Emit the TITLE section, then the DISPLAY section, each verbatim per its marker.

Store the DATA `proceed_name` as `{topic}`. Nothing was picked, so confirm what proceeding does:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render spec-confirm-gate {work_unit}.specification.{topic} --single
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `yes`

**If `single_variant` is `no-spec`:**

No specification covers the discussion yet. Land it as a proposed grouping of the DATA `single_discussion`, so its source is on the manifest before the handoff:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} status=proposed sources.{single_discussion}.status=pending
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --state -m "spec({work_unit}): propose {topic}"
```

→ Return to caller.

**Otherwise:**

→ Return to caller.

#### If `no`

→ Return to caller for **A. State Display and Menu**.

---

## C. Analyze Prompt

Several completed discussions, none in progress, and neither a proposed grouping nor a started specification. Render the snapshot:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs spec-view {work_unit}
```

Emit the TITLE section, then the DISPLAY section, each verbatim per its marker.

> *Output the next fenced block as markdown (not a code block):*

```
> @if(cache_status is stale) Analysis outdated — discussions have changed since the last grouping analysis. @endif Your discussions will be analyzed for natural groupings, each one a proposed specification you can start when ready. Results are cached and reused until discussions change.
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render analysis-proceed-gate {work_unit}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **D. Handle the Prompt**.

---

## D. Handle the Prompt

#### If `yes`

→ Proceed to **E. Run the Analysis**.

#### If `no`

→ Return to caller for **A. State Display and Menu**.

---

## E. Run the Analysis

The analysis reads the completed discussions and rewrites `.state/` staging that is work-unit-wide — a peer session holding a source topic open, however long it has idled, is still working material it would read, and the pass would overwrite whatever an earlier one staged. Check first:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}
```

#### If the response has `held_sources` greater than `0`

Hold off — the analysis reads the settled record, so it waits for those sessions. Emit the response's `DISPLAY: presence deferral` section now, verbatim per its marker.

→ Return to caller for **A. State Display and Menu**.

#### Otherwise

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.

→ On return, return to **A. Route on the Scenario**.

---

## F. Groupings Menu

Proposed groupings exist. Each numbered item is a specification item from the manifest — proposed groupings and materialized specs alike; the tree, the menu, and the `ACTIONS` table share one ordering and numbering.

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs spec-view {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.

**STOP.** Wait for user response.

Match the user's input to its `ACTIONS` entry — a number or a command option's letter by `key`, its long form by `word`. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `start_spec` or `continue_spec`

Store the entry's `topic` as `{topic}`.

→ Return to caller.

#### If `action` is `blocked_spec`

The item's source discussions reopened — it cannot be entered until they re-conclude. Tell the user in one line which discussions hold it (the item's `blocked_by` in DATA names them) and that concluding those unlocks the spec, then re-present.

→ Return to **F. Groupings Menu**.

#### If `action` is `completed_menu`

→ Proceed to **H. Completed Specifications**.

#### If `action` is `unify`

**If `unified` is already a key in the DATA section** — a non-proposed item under `specifications:` (an anchor), or any entry under `cancelled_specifications:` (its key stays reserved):

Do NOT proceed — the reconcile's invariant: an anchor is never overwritten by a proposed item, and a cancelled key is never reused. Tell the user in one line that the name is taken and which item holds it, then re-present.

→ Return to **F. Groupings Menu**.

**Otherwise:**

Reconcile the manifest to a single proposed grouping immediately, so it never lags the cache. The target proposed set is `{unified}`:
1. Collect a `delete` op for every existing proposed item — none survive into the target set.
2. Collect the `unified` upsert — `status: proposed` plus one `sources.{discussion}.status: pending` per completed discussion — the row shape every later source takes, a topic the specification's gap exit opens included.
3. Assign the build order over the surviving live set — `unified` plus every `in-progress` or `completed` anchor — as contiguous integers `1..N` (the deleted proposed items' numbers die with them, so the set renumbers whole). Collect one `order: {N}` field per topic — a bare number, never quoted — folding `unified`'s into its upsert and giving each anchor its own `set` op. Check whether a completed specification has flagged the order stale (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {work_unit}.specification build_order_stale`); when `true`, collect `{work_unit}.specification` → delete `build_order_stale` — this reconcile is the sequencing, so the flag clears with it. Write the ops to `.workflows/.cache/{work_unit}/specification/unify-ops.json` with the Write tool, then persist deletes, upsert, and orders in one atomic call:
   ```json
   [{"op": "delete", "path": "{work_unit}.specification", "field": "items.{name}"},
    {"op": "set", "path": "{work_unit}.specification.unified", "fields": {"status": "proposed", "sources.{discussion}.status": "pending", "order": 1}}]
   ```
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest apply {work_unit} --file .workflows/.cache/{work_unit}/specification/unify-ops.json
   ```

Then rewrite `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` with a single "Unified" grouping containing all completed discussions. Add note: `Custom groupings confirmed by user (unified).`

The cache's checksum stays as it is; restamp its date:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discussion analysis_cache.generated "{ISO date}"
```

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --state -m "spec({work_unit}): reconcile proposed groupings"
```

Store `unified` as `{topic}`, and that this selection is the unify — the caller's confirm reads it.

→ Return to caller.

#### If `action` is `reanalyze`

→ Proceed to **E. Run the Analysis**.

#### If `action` is `back`

→ Return to caller for **A. State Display and Menu**.

---

## G. Specifications Menu

Materialized specifications exist and no proposed groupings remain. The tree, the menu, and the `ACTIONS` table share one ordering and numbering; concluded specs live behind `c/completed`.

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs spec-view {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.

**STOP.** Wait for user response.

Match the user's input to its `ACTIONS` entry — a number or a command option's letter by `key`, its long form by `word`. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `analyze`

→ Proceed to **E. Run the Analysis**.

#### If `action` is `continue_spec`

Store the entry's `topic` as `{topic}`.

→ Return to caller.

#### If `action` is `blocked_spec`

The spec's source discussions reopened — it cannot be entered until they re-conclude. Tell the user in one line which discussions hold it (the spec's `blocked_by` in DATA names them) and that concluding those unlocks the spec, then re-present.

→ Return to **G. Specifications Menu**.

#### If `action` is `completed_menu`

→ Proceed to **H. Completed Specifications**.

#### If `action` is `back`

→ Return to caller for **A. State Display and Menu**.

---

## H. Completed Specifications

Render the concluded-specs sub-view:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs spec-completed-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.

**STOP.** Wait for user response.

Match the user's input to its `ACTIONS` entry by `key` or `word`.

#### If `action` is `refine_spec`

Store the entry's `topic` as `{topic}`.

→ Return to caller.

#### If `action` is `back`

→ Return to **A. Route on the Scenario**.
