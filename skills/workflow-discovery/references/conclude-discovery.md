# Conclude Discovery

*Reference for **[workflow-discovery](../SKILL.md)***

---

Finalise the discovery session and hand off through the bridge. Used by every work type — the bridge returns an epic to its menu and hands every other type off to its first phase, each in a clean context.

Two anti-patterns (all work types):

- **Don't index here.** Epic discovery indexing is the harvest's job — `confirm-and-persist.md` §D indexes each finalised epic session log into the knowledge base. Single-phase discovery logs are thin shape-and-route and aren't indexed at all. Either way, conclusion does not call `knowledge index`.
- **Do not set a phase-level `status: completed`.** Discovery is alive as long as the work unit is in-progress; phase completion is emergent from the items themselves, not a manifest field on the phase.

`next_phase` is set by the single-phase endpoints (`research` / `discussion` / `investigation` / `scoping`); epic leaves it unset.

## A. Final Sweep

Check `git status`. If the working tree is dirty (e.g. an endpoint's Conclusion write or marker clear), commit the residual changes:

```bash
git add -- .workflows/{work_unit}/
git commit -m "discovery({work_unit}): finalise session log"
```

If the working tree is already clean, skip the commit.

→ Proceed to **B. Bridge**.

## B. Bridge

> *Output the next fenced block as markdown (not a code block):*

```
> Discovery complete — entering plan mode to hand off the next
> step in a clean context.
```

```
Pipeline bridge for: {work_unit}
Completed phase: discovery
@if(next_phase is set) Next phase: {next_phase} @endif

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.
