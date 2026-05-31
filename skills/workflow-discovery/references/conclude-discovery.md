# Conclude Discovery

*Reference for **[workflow-discovery](../SKILL.md)***

---

Two anti-patterns to avoid (the discussion-process precedent does both, but discovery does neither):

- **Do not call `knowledge index`.** Discovery is not a knowledge-base indexed phase — session logs are journey records, not retrievable artifacts.
- **Do not set a phase-level `status: completed`.** Discovery is alive as long as the work unit is in-progress; phase completion is emergent from the items themselves, not a manifest field on the phase.

## A. Final Sweep

Check `git status`. If the working tree is dirty, commit the residual changes:

```bash
git add -- .workflows/{work_unit}/
git commit -m "discovery({work_unit}): finalise session log"
```

If the working tree is already clean, skip the commit.

→ Proceed to **B. Bridge**.

## B. Bridge

> *Output the next fenced block as markdown (not a code block):*

```
> Discovery session complete. Returning to the epic menu so you
> can pick the next move from the discovery map.
```

```
Pipeline bridge for: {work_unit}
Completed phase: discovery

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.
