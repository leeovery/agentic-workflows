# The Briefing

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

## A. Present the Design

Present the design conversationally in plain terms, as markdown paragraphs — never a file dump: what we'll do, what we expect and why, and what each outcome triggers ("if the rule reads X we do A; if Y, B"). State what the freeze means as part of the presentation: from approval, changes before results are visible are dated amendments re-confirmed with the user; once results are visible the design is frozen for good. The user's challenges are part of the method — changes fold into `{dir}/design.md` now, before the freeze, and the amended design is re-presented.

Then fetch the gate and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-approval-gate {work_unit}.experiment.{topic} --id {id}
```

**STOP.** Wait for user response.

#### If `approve`

Record the freeze and commit — from here the design changes only by **[amendment-protocol.md](amendment-protocol.md)**:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment approve {work_unit} {topic} {id}
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} approved — design frozen"
```

**If the engine refused the approve:**

The record moved beneath the session — a peer closed or cancelled it, and the manifest's answer stands. Say so in one line.

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

**Otherwise:**

→ Return to caller.

#### If amend

Fold the changes into `{dir}/design.md` — the record is still `designed`, so the same gate serves the amended design.

→ Return to **A. Present the Design**.

#### If `abandon`

The experiment is abandoned before it ran.

→ Load **[abandon-experiment.md](abandon-experiment.md)** with id = `{id}`.

→ On return, return to caller.
