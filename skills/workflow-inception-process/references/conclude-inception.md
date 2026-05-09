# Conclude Inception

*Reference for **[workflow-inception-process](../SKILL.md)***

---

The persistence step has already written manifest items, finalised the session log, and committed. Document review and compliance self-check have run. This step closes the session and bridges back to the epic menu.

Inception is **not** a knowledge-base indexed phase — session logs are journey records, not retrievable artifacts. There is no `knowledge index` call here.

There is also no per-phase `status: completed` write. Inception is alive as long as the work unit is in-progress; individual items exist or don't. Phase completion is an emergent property of the items themselves, not a manifest field on the phase.

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

Check `git status`. If the working tree is dirty (review fixes that were not committed, or any other stray edit), commit the residual changes now with a descriptive message:

```bash
git add -- .workflows/{work_unit}/
git commit -m "inception({work_unit}): finalise session log"
```

If the working tree is already clean, skip the commit.

→ Proceed to **C. Bridge**.

## C. Bridge

Hand off to the bridge skill. The bridge enters plan mode with deterministic continuation instructions for `/continue-epic {work_unit}`.

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
