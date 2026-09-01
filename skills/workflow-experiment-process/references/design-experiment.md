# Design the Experiment

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

Author `{dir}/design.md` with the user — load **[design-template.md](design-template.md)** for the skeleton and the conditional sections. The conversation does the designing: what exactly is the question and the decision it feeds, what do we predict and why, what rule settles it, how will we measure — method, instruments and their versions, sample, environment. The setup names the execution shape the run will take (see the run leg's shapes) — the shape of the experiment follows the shape of the problem, proposed here.

Depth scales with the shape — a ten-minute local test writes four lines per section; a multi-day run writes pages — but the skeleton never scales away, and one primary question is the width limit: anything else measured is explicitly secondary.

#### If the user abandons the experiment before the design settles

→ Load **[abandon-experiment.md](abandon-experiment.md)** with id = `{id}`.

→ On return, return to caller.

#### Otherwise

When the design is written, record the step and commit — the commit carries the design file and the manifest together:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment advance {work_unit} {topic} {id}
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} designed"
```

**If the engine refused the advance:**

The record moved beneath the session — a peer closed or cancelled it, and the manifest's answer stands. Say so in one line.

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

**Otherwise:**

→ Return to caller.
