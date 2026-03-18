# Define Phases

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step uses the `workflow-planning-phase-designer` agent (`../../../agents/workflow-planning-phase-designer.md`) to define or review the phase structure. Whether phases are being designed for the first time or reviewed from a previous session, the process converges on the same approval gate.

---

## A. Determine Phase State

Read the planning file at `.workflows/{work_unit}/planning/{topic}/planning.md`. Check if phases already exist in the body.

#### If phases exist

> *Output the next fenced block as a code block:*

```
Phase structure already exists. I'll present it for your review.
```

→ Proceed to **B. Review and Approve**.

#### If no phases exist

> *Output the next fenced block as a code block:*

```
I'll delegate phase design to a specialist agent. It will read the full
specification and propose a phase structure — how we break this into
independently testable stages.
```

Read `work_type` from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} work_type
```

Invoke `workflow-planning-phase-designer` with these file paths:

1. **read-specification.md**: `read-specification.md`
2. **Specification**: specification path from the manifest or `.workflows/{work_unit}/specification/{topic}/specification.md`
3. **Cross-cutting specs**: cross-cutting spec paths if any
4. **phase-design.md**: `phase-design.md`
5. **Context guidance**: `phase-design/{work_type}.md` (default to `epic` if `work_type` is empty)
6. **task-design.md**: `task-design.md`

The agent returns a complete phase structure. Write it directly to the planning file body.

Update the manifest planning position:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} phase 1
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task ~
```

Commit: `planning({work_unit}): draft phase structure`

→ Proceed to **B. Review and Approve**.

---

## B. Review and Approve

Present the phase structure to the user as rendered markdown (not in a code block). Then, separately, present the choices:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve this phase structure?

- **`y`/`yes`** — Proceed to task breakdown
- **Tell me what to change** — reorder, split, merge, add, edit, or remove phases
- **Navigate** — a different phase or task, or the leading edge
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If the user provides feedback

Re-invoke `workflow-planning-phase-designer` with all original inputs PLUS:
- **Previous output**: the current phase structure
- **User feedback**: what the user wants changed

Update the planning file with the revised output.

→ Return to **B. Review and Approve**.

#### If `approved`

**If the phase structure is new or was amended:**

1. Create phases in the output format immediately (via the format's **[authoring.md](output-formats/{format}/authoring.md)** — phase parent tasks for tick, phase labels for linear, phase directories for local-markdown)
2. Record each phase's internal ID → external ID mapping in `task_map`:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task_map.{phase_internal_id} {phase_external_id}
   ```
3. Commit: `planning({work_unit}): approve phase structure`

If the phase structure was already approved and unchanged, no updates are needed.

→ Return to caller.
