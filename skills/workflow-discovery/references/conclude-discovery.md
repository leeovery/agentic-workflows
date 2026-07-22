# Conclude Discovery

*Reference for **[workflow-discovery](../SKILL.md)***

---

Finalise the discovery session and hand off through the bridge. Used by every work type — the bridge returns an epic to its menu and hands every other type off to its first phase, each in a clean context.

Two anti-patterns (all work types):

- **Don't index here.** Epic discovery indexing is the harvest's job — `confirm-and-persist.md` §C's `discovery-session close` indexes each finalised epic session log into the knowledge base. Single-phase discovery logs are thin shape-and-route and aren't indexed at all. Either way, conclusion does not call `knowledge index`.
- **Do not set a phase-level `status: completed`.** Discovery is alive as long as the work unit is in-progress; phase completion is emergent from the items themselves, not a manifest field on the phase.

`next_phase` is set by the single-phase endpoints (`research` / `discussion` / `investigation` / `scoping`); epic leaves it unset.

## A. Final Sweep

Commit any residual changes (e.g. an endpoint's Conclusion write or marker clear) — a clean tree reports `committed: null` and is fine:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): finalise session log"
```

→ Proceed to **B. Bridge**.

## B. Bridge

> *Output the next fenced block as markdown (not a code block):*

```
> Discovery complete — entering plan mode to hand off the next
> step in a clean context.
```

**If `next_phase` is set:** Invoke `/workflow-bridge {work_unit} discovery {next_phase}`.

**If not:** Invoke `/workflow-bridge {work_unit} discovery`.
