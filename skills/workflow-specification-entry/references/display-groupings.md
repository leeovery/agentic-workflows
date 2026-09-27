# Display: Groupings

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Shows when proposed groupings exist — reached from routing, or after an analysis that leaves some. Each numbered item is a specification item from the manifest — proposed groupings and materialized specs alike. The tree, the menu, and the `ACTIONS` table share one ordering and numbering — they map 1:1.

## A. Display and Menu

Render the scoped snapshot:

```bash
node .claude/skills/workflow-specification-entry/scripts/gateway.cjs view {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Match the user's input to its `ACTIONS` entry — a number or a command option's letter by `key`, its long form by `word`. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `start_spec` or `continue_spec`

The entry's `topic` and `verb`, plus that item's DATA detail (sources, consult references), become the context for confirmation.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

→ On return, return to **A. Display and Menu**.

#### If `action` is `blocked_spec`

The item's source discussions reopened — it cannot be entered until they re-conclude. Tell the user in one line which discussions hold it (the item's `blocked_by` in DATA names them) and that concluding those unlocks the spec, then re-present.

→ Return to **A. Display and Menu**.

#### If `action` is `completed_menu`

→ Load **[display-completed-specs.md](display-completed-specs.md)** and follow its instructions as written.

→ On return, return to **A. Display and Menu**.

#### If `action` is `unify`

**If `unified` is already a key in the DATA section** — a non-proposed item under `specifications:` (an anchor), or any entry under `cancelled_specifications:` (its key stays reserved):

Do NOT proceed — reconcile step 6's invariant: an anchor is never overwritten by a proposed item, and a cancelled key is never reused. Tell the user in one line that the name is taken and which item holds it, then re-present.

→ Return to **A. Display and Menu**.

**Otherwise:**

Reconcile the manifest to a single proposed grouping immediately, so it never lags the cache. The target proposed set is `{unified}`:
1. Collect a `delete` op for every existing proposed item (reconcile step 5 — none survive into the target set).
2. Collect the `unified` upsert — `status: proposed` plus one `sources.{discussion}.status: pending` per completed discussion (reconcile step 7) — the row shape every later source takes, a topic the specification's gap exit opens included.
3. Assign the build order over the surviving live set — `unified` plus every `in-progress` or `completed` anchor — as contiguous integers `1..N` (reconcile step 8; the deleted proposed items' numbers die with them, so the set renumbers whole). Collect one `order: {N}` field per topic — a bare number, never quoted — folding `unified`'s into its upsert and giving each anchor its own `set` op. Check whether a completed specification has flagged the order stale (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {work_unit}.specification build_order_stale`); when `true`, collect `{work_unit}.specification` → delete `build_order_stale` — this reconcile is the sequencing, so the flag clears with it. Write the ops to `.workflows/.cache/{work_unit}/specification/unify-ops.json` with the Write tool, then persist deletes, upsert, and orders in one atomic call:
   ```json
   [{"op": "delete", "path": "{work_unit}.specification", "field": "items.{name}"},
    {"op": "set", "path": "{work_unit}.specification.unified", "fields": {"status": "proposed", "sources.{discussion}.status": "pending", "order": 1}}]
   ```
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest apply {work_unit} --file .workflows/.cache/{work_unit}/specification/unify-ops.json
   ```

Then rewrite `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` with a single "Unified" grouping containing all completed discussions. Keep the same checksum, update the generated timestamp. Add note: `Custom groupings confirmed by user (unified).`

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --state -m "spec({work_unit}): reconcile proposed groupings"
```

Spec name: "Unified". Sources: all completed discussions.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

→ On return, return to **A. Display and Menu**.

#### If `action` is `reanalyze`

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.
