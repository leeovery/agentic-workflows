# Define Phases

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step uses the `workflow-planning-phase-designer` agent (`../../../agents/workflow-planning-phase-designer.md`) to define or review the phase structure. Whether phases are being designed for the first time or reviewed from a previous session, the process converges on the same approval gate.

---

## A. Determine Phase State

Read the planning file at `.workflows/{work_unit}/planning/{topic}/planning.md`. Check if phases already exist in the body.

#### If phases exist

> *Output the next fenced block as markdown (not a code block):*

```
Phase structure already exists. I'll present it for your review.
```

→ Proceed to **B. Review and Approve**.

#### If no phases exist

> *Output the next fenced block as markdown (not a code block):*

```
I'll delegate phase design to a specialist agent. It will read the full specification and propose a phase structure — how we break this into independently testable stages.
```

Read `work_type` from the manifest:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

Invoke `workflow-planning-phase-designer` with these file paths:

1. **read-specification.md**: `read-specification.md`
2. **Specification**: specification path from the manifest or `.workflows/{work_unit}/specification/{topic}/specification.md`
3. **Cross-cutting specs**: cross-cutting spec paths if any
4. **phase-design.md**: `phase-design.md`
5. **Context guidance**: `phase-design/{work_type}.md` (default to `epic` if `work_type` is empty)
6. **task-design.md**: `task-design.md` *(for granularity awareness only — helps the agent judge whether a phase is too thin or too thick. The agent must NOT produce task tables or task lists.)*

The agent returns phases only — goals, ordering rationale, and acceptance criteria. **Task lists are designed separately in a later step; do not request or include them.** Write the phase structure directly to the planning file body.

**Settle the spec defects** — classified before the structure gate renders, so what the user approves was designed against a correct specification. The section is the orchestrator's: it never reaches the planning file.

**If the return carries a `## Spec Defects` section** — once per entry:

→ Load **[resolve-spec-gap.md](resolve-spec-gap.md)** with lane = `construction`, gap = `{the entry, and the phase it surfaced in}`.

Where a landing changed the specification, or the reference returned work the plan must carry — the tree owing what the specification decides — re-invoke `workflow-planning-phase-designer` through its amendment path with the corrections and that work as the feedback, and write the revised structure to the planning file. Settle that return's `## Spec Defects` the same way, once: a defect the designer still reports after one re-run is left to the review walk, which meets the plan against the specification at the end of the phase. When at least one corrigendum landed — nothing when none did, never a per-correction recap — fetch and emit the `DISPLAY: spec corrections` section verbatim as a code block:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render spec-corrections --count {count}
```

**Otherwise:** nothing to settle — continue.

Update the manifest planning position — one batched write:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} phase=1 task='~'
```

Commit:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): draft phase structure" --topic planning/{topic}
```

→ Proceed to **B. Review and Approve**.

---

## B. Review and Approve

Write the phase-tree payload to `.workflows/.cache/{work_unit}/planning/{topic}/phase-tree.json` with the Write tool — one entry per phase from the planning file, each with its goal (and other one-line detail rows worth surfacing, e.g. acceptance criteria):

```json
{"phases": [{"name": "…", "detail": [["Goal", "…"], ["Criteria", "…"]]}]}
```

Render and emit each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-tree {work_unit}.planning.{topic} --file .workflows/.cache/{work_unit}/planning/{topic}/phase-tree.json --approve
```

**STOP.** Wait for user response.

→ Proceed to **C. Handle Response**.

---

## C. Handle Response

#### If `view full`

Present the full phase structure from the planning file as rendered markdown (not a code block) — goals, ordering rationale, acceptance criteria as the designer wrote them. Then put the gate back beneath it — the gate alone, the tree already shown above:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-tree {work_unit}.planning.{topic} --menu-only
```

Emit its `MENU: phase structure gate` section verbatim per its marker.

**STOP.** Wait for user response.

→ Return to **C. Handle Response**.

#### If the user provides feedback

Re-invoke `workflow-planning-phase-designer` with all original inputs PLUS:
- **Previous output**: the current phase structure
- **User feedback**: what the user wants changed

The revision reads the specification again, so its defects are settled before the revised output is written — once per `## Spec Defects` entry:

→ Load **[resolve-spec-gap.md](resolve-spec-gap.md)** with lane = `construction`, gap = `{the entry, and the phase it surfaced in}`.

Where a landing changed the specification, re-invoke the designer once more with the corrections as the feedback; a defect it still reports after that re-run is left to the review walk. Update the planning file with the revised output.

→ Return to **B. Review and Approve**.

#### If navigate

Resolve the destination per the caller's **Navigation** section — the user's position moves, the leading edge does not.

→ Return to caller for **B. Process Current Phase**.

#### If `yes`

**If the phase structure is new or was amended:**

1. Record the approval — `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} approvals.structure $(date +%Y-%m-%d)`
2. Commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): approve phase structure" --topic planning/{topic}
   ```

If the manifest already carries `approvals.structure` and the structure is unchanged, no updates are needed.

→ Return to caller.
