# Route to First Phase

*Reference for **[workflow-bootstrap](../SKILL.md)***

---

Hand off to the work-type-appropriate entry skill. The routing matrix is determined by `work_type` × `routing`:

| `work_type` | `routing` | Entry skill |
|---|---|---|
| `epic` | (n/a — per-topic) | `/workflow-bridge` (returns the user to the epic discovery-map menu so they can pick the next move per topic) |
| `feature` | `research` | `/workflow-research-entry feature {work_unit}` |
| `feature` | `discussion` | `/workflow-discussion-entry feature {work_unit}` |
| `cross-cutting` | `research` | `/workflow-research-entry cross-cutting {work_unit}` |
| `cross-cutting` | `discussion` | `/workflow-discussion-entry cross-cutting {work_unit}` |
| `bugfix` | `investigation` (fixed) | `/workflow-investigation-entry bugfix {work_unit}` |
| `quick-fix` | `scoping` (fixed) | `/workflow-scoping-entry quick-fix {work_unit}` |

## A. Dispatch

> *Output the next fenced block as a code block:*

```
── Route to {phase:(titlecase)} ─────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the {phase} entry skill. The next skill will
> load and guide you through the phase.
```

#### If `work_type` is `epic`

Invoke `/workflow-bridge` with the discovery completion handoff. The user is returned to the discovery-map menu so they can pick the next topic to start.

```
Pipeline bridge for: {work_unit}
Completed phase: discovery

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

Terminal.

#### If `work_type` is `feature` or `cross-cutting`

Invoke the routed entry skill. The skill is selected by `routing`:

- `routing == research` → `/workflow-research-entry {work_type} {work_unit}`
- `routing == discussion` → `/workflow-discussion-entry {work_type} {work_unit}`

Terminal.

#### If `work_type` is `bugfix`

Routing is fixed to `investigation`:

`/workflow-investigation-entry bugfix {work_unit}`

Terminal.

#### If `work_type` is `quick-fix`

Routing is fixed to `scoping`:

`/workflow-scoping-entry quick-fix {work_unit}`

Terminal.

## B. Failure Mode — Unknown Routing

If `work_type` is unrecognised or `routing` does not match an expected value for the work_type, surface the error and stop. This indicates an upstream bug in Discovery's commit:

```
Bootstrap routing failed.

work_type = {work_type}
routing   = {routing}

Re-enter Discovery via /workflow-start to repeat the routing commit.
```

**STOP.** Do not proceed — terminal condition.
