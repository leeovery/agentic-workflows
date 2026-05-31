# Intent Capture

*Reference for **[workflow-discovery](../SKILL.md)***

---

The endpoint for a bugfix or quick-fix: no routing to decide and nothing to decompose, so capture the intent and hand off. The work is already shaped and persisted — the manifest `description` and the session log carry the intent. Add no gate here; the macro commit and name were the only interactions.

## A. Conclude

Finalise the session log carrier: replace the `(none)` **Conclusion** with a one-line note (`Routed to {investigation | scoping}.`). Clear the active-session marker and commit:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery active_session
git add -- .workflows/{work_unit}/
git commit -m "discovery({work_unit}): conclude — route to {investigation|scoping}"
```

If `git status` reports nothing to commit, skip the commit.

→ Proceed to **B. Route to First Phase**.

## B. Route to First Phase

Invoke the first-phase entry for the work type:

| Work type | Invoke |
|---|---|
| bugfix | `/workflow-investigation-entry bugfix {work_unit}` |
| quick-fix | `/workflow-scoping-entry quick-fix {work_unit}` |

The entry skill reads the durable carrier (session log + manifest `description`) as its seed.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
