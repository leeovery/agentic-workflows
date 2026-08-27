# Display: Groupings

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Shows when proposed groupings exist (directly from routing) or after analysis completes. Each numbered item is a specification item from the manifest — proposed groupings and materialized specs alike. The tree, the menu, and the `ACTIONS` table share one ordering and numbering — they map 1:1.

## A. Display

Re-run the scoped snapshot — the emission draws from this response, never a carried one:

```bash
node .claude/skills/workflow-specification-entry/scripts/gateway.cjs view {work_unit}
```

Emit the TITLE section (markdown), then the DISPLAY section verbatim as a code block.

→ Proceed to **B. Menu**.

---

## B. Menu

Emit the MENU section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

Match the user's input to its `ACTIONS` entry by `key` — a number, or the command option's letter / long form. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `start_spec` or `continue_spec`

The entry's `topic` and `verb`, plus that item's DATA detail (sources, consult references), become the context for confirmation.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If `action` is `blocked_spec`

The item's source discussions reopened — it cannot be entered until they re-conclude. Tell the user in one line which discussions hold it (the item's `blocked_by` in DATA names them) and that concluding those unlocks the spec, then re-present.

→ Return to **B. Menu**.

#### If `action` is `completed_menu`

→ Load **[display-completed-specs.md](display-completed-specs.md)** and follow its instructions as written.

→ Return to **B. Menu**.

#### If `action` is `unify`

Reconcile the manifest to a single proposed grouping immediately, so it never lags the cache. The target proposed set is `{unified}`:
1. Collect a `delete` op for every existing proposed item (reconcile step 5 — none survive into the target set). If an **anchor** is keyed `unified` (a non-proposed spec already using the name), do NOT proceed — surface it as a naming conflict to the user (reconcile step 6's invariant: an anchor is never overwritten by a proposed item).
2. Collect the `unified` upsert — `status: proposed` plus one `sources.{discussion}.status: pending` per completed discussion (reconcile step 7).
3. Assign the build order over the surviving live set — `unified` plus every anchor whose status is not `cancelled`/`superseded`/`promoted` — as contiguous integers `1..N` (reconcile step 8; the deleted proposed items' numbers die with them, so the set renumbers whole). Collect one `order: {N}` field per topic — a bare number, never quoted — folding `unified`'s into its upsert and giving each anchor its own `set` op. Check whether a completed specification has flagged the order stale (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {work_unit}.specification build_order_stale`); when `true`, collect `{work_unit}.specification` → delete `build_order_stale` — this reconcile is the sequencing, so the flag clears with it. Write the ops to `.workflows/.cache/{work_unit}/specification/unify-ops.json` with the Write tool, then persist deletes, upsert, and orders in one atomic call:
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

#### If `action` is `reanalyze`

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.
