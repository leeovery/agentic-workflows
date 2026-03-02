# Define Phases

*Reference for **[technical-planning](../SKILL.md)***

---

This step uses the `planning-phase-designer` agent (`../../../agents/planning-phase-designer.md`) to define or review the phase structure. Whether phases are being designed for the first time or reviewed from a previous session, the process converges on the same approval gate.

---

## Determine Phase State

Read the Plan Index File. Check if phases already exist in the body.

#### If phases exist

> *Output the next fenced block as a code block:*

```
Phase structure already exists. I'll present it for your review.
```

Continue to **Review and Approve** below.

#### If no phases exist

> *Output the next fenced block as a code block:*

```
I'll delegate phase design to a specialist agent. It will read the full
specification and propose a phase structure — how we break this into
independently testable stages.
```

### Invoke the Agent

Read `work_type` from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.work_type
```

Invoke `planning-phase-designer` with these file paths:

1. **read-specification.md**: `read-specification.md`
2. **Specification**: specification path from the manifest or `.workflows/{work_unit}/specification/specification.md`
3. **Cross-cutting specs**: cross-cutting spec paths if any
4. **phase-design.md**: `phase-design.md`
5. **Context guidance**: `phase-design/{work_type}.md` (default to `epic` if `work_type` is empty)
6. **task-design.md**: `task-design.md`
7. **plan-index-schema.md**: `plan-index-schema.md`

The agent returns a complete phase structure. Write it directly to the Plan Index File body.

Update the manifest planning position:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.planning.phase 1
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.planning.task ~
```

Commit: `planning({topic}): draft phase structure`

Continue to **Review and Approve** below.

---

## Review and Approve

Present the phase structure to the user as rendered markdown (not in a code block). Then, separately, present the choices:

**STOP.** Ask:

**Phase Structure**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**To proceed:**
- **`y`/`yes`** — Approved. I'll proceed to task breakdown.
- **Or tell me what to change** — reorder, split, merge, add, edit, or remove phases.
- **Or navigate** — a different phase or task, or the leading edge.
· · · · · · · · · · · ·
```

#### If the user provides feedback

Re-invoke `planning-phase-designer` with all original inputs PLUS:
- **Previous output**: the current phase structure
- **User feedback**: what the user wants changed

Update the Plan Index File with the revised output, re-present, and ask again. Repeat until approved.

#### If `approved`

**If the phase structure is new or was amended:**

1. Update each phase in the Plan Index File: set `status: approved` and `approved_at: YYYY-MM-DD` (use today's actual date). See **Phase Entry** in plan-index-schema for field definitions.
2. Commit: `planning({topic}): approve phase structure`

**If the phase structure was already approved and unchanged:** No updates needed.
