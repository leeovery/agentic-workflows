# Display: Groupings

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Shows when proposed groupings exist (directly from routing) or after analysis completes. Each numbered item is a specification item from the manifest — proposed groupings and materialized specs alike. The tree, the menu, and the `ACTIONS` table share one ordering and numbering — they map 1:1.

## A. Display

Arriving from **[analysis-flow.md](analysis-flow.md)**, the manifest changed since the last snapshot — re-run it first:

```bash
node .claude/skills/workflow-specification-entry/scripts/gateway.cjs view {work_unit}
```

Arriving from routing, use the Step 1 snapshot as-is.

Emit the DISPLAY section verbatim as a code block.

→ Proceed to **B. Menu**.

---

## B. Menu

Emit the MENU section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

Match the user's input to its `ACTIONS` entry by `key` — a number, or the command option's letter / long form. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `start_spec` or `continue_spec`

The entry's `topic` and `verb`, plus that item's DATA detail (sources, consult references), become the context for confirmation.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If `action` is `completed_menu`

→ Load **[display-completed-specs.md](display-completed-specs.md)** and follow its instructions as written.

→ Return to **B. Menu**.

#### If `action` is `unify`

Reconcile the manifest to a single proposed grouping immediately, so it never lags the cache. The target proposed set is `{unified}`:
1. Collect a `delete` op for every existing proposed item (reconcile step 5 — none survive into the target set).
2. Collect the `unified` upsert — `status: proposed` plus one `sources.{discussion}.status: pending` per completed discussion (reconcile step 7) — then persist deletes and upsert in one atomic call:
   ```json
   [{"op": "delete", "path": "{work_unit}.specification", "field": "items.{name}"},
    {"op": "set", "path": "{work_unit}.specification.unified", "fields": {"status": "proposed", "sources.{discussion}.status": "pending"}}]
   ```
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest apply {work_unit} --file .workflows/.cache/{work_unit}/specification/reconcile-ops.json
   ```

Then rewrite `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` with a single "Unified" grouping containing all completed discussions. Keep the same checksum, update the generated timestamp. Add note: `Custom groupings confirmed by user (unified).`

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): reconcile proposed groupings"
```

Spec name: "Unified". Sources: all completed discussions.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If `action` is `reanalyze`

Delete the cache:
```bash
rm .workflows/{work_unit}/.state/discussion-consolidation-analysis.md
```

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.
