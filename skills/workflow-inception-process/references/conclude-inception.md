# Conclude Inception

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Two anti-patterns to avoid (the discussion-process precedent does both, but inception does neither):

- **Do not call `knowledge index`.** Inception is not a knowledge-base indexed phase — session logs are journey records, not retrievable artifacts.
- **Do not set a phase-level `status: completed`.** Inception is alive as long as the work unit is in-progress; phase completion is emergent from the items themselves, not a manifest field on the phase.

## A. Final Confirmation

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Conclude inception and return to the epic menu?

- **`y`/`yes`** — Conclude and bridge back to /continue-epic
- **`n`/`no`** — Stay in the session for further refinement
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

#### If `yes`

→ Proceed to **B. Final Sweep**.

## B. Final Sweep

Check `git status`. If the working tree is dirty, commit the residual changes:

```bash
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): finalise session log"
```

If the working tree is already clean, skip the commit.

→ Proceed to **C. Bridge**.

## C. Bridge

> *Output the next fenced block as markdown (not a code block):*

```
> Inception complete. The discovery map is seeded — return to
> the epic menu to start, continue, or refine any topic.
```

```
Pipeline bridge for: {work_unit}
Completed phase: inception

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.
