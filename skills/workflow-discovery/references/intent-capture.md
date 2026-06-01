# Intent Capture

*Reference for **[workflow-discovery](../SKILL.md)***

---

The endpoint for a bugfix or quick-fix: no routing to decide and nothing to decompose, so set the first phase and conclude through the bridge. The work is already shaped and persisted — the manifest `description` and the session log carry the intent. Add no gate here; the macro commit and name were the only interactions.

## A. Finalise

Set `next_phase` from the work type: bugfix → `investigation`, quick-fix → `scoping`.

Finalise the session log carrier: replace its `(none)` **Conclusion** with a one-line note — `Routed to {next_phase}.` Clear the active-session marker:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery active_session
```

Leave the commit to the conclude step (it sweeps these changes).

→ Load **[conclude-discovery.md](conclude-discovery.md)** and follow its instructions as written. It commits and hands off to `/workflow-{next_phase}-entry {work_type} {work_unit}` through the bridge.
