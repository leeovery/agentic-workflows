# Conclude Discovery

*Reference for **[workflow-discovery-process](../SKILL.md)***

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

Bridge varies by `work_type` — epic returns to the discovery map menu so the user can pick the next move; non-epic single-topic work types continue directly into the routed phase (the bootstrap utility wires this in Phase 17d; here the bridge handoff names the destination).

#### If `work_type` is `epic` (or missing — epic is default for back-compat)

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

#### If `work_type` is `feature` or `cross-cutting`

The single-topic shape was committed in confirm-and-persist with its routing decision. Bridge into the routed phase via the bootstrap utility — bootstrap creates any missing manifest state, copies imports to their final location, and routes to research or discussion based on the per-topic routing.

> *Output the next fenced block as markdown (not a code block):*

```
> Discovery session complete. Routing into {research|discussion}
> via workflow-bootstrap.
```

```
Pipeline bridge for: {work_unit}
Completed phase: discovery
Next phase: {research|discussion}

Invoke the workflow-bootstrap skill with work_type={work_type}, work_unit={work_unit}, routing={research|discussion}.
```

**STOP.** Do not proceed — terminal condition.

#### If `work_type` is `bugfix` or `quick-fix`

The intent paragraph and routing decision were committed in confirm-and-persist. Bridge into the routed phase via the bootstrap utility — bootstrap routes to investigation (bugfix) or scoping (quickfix).

> *Output the next fenced block as markdown (not a code block):*

```
> Discovery session complete. Routing into {investigation|scoping}
> via workflow-bootstrap.
```

```
Pipeline bridge for: {work_unit}
Completed phase: discovery
Next phase: {investigation|scoping}

Invoke the workflow-bootstrap skill with work_type={work_type}, work_unit={work_unit}, routing={investigation|scoping}.
```

**STOP.** Do not proceed — terminal condition.
