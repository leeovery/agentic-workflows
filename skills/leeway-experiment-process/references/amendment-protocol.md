# Amendment Protocol

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

Governs any change to an approved design. Two temporal rules, and the boundary between them is the first visible result — not the `running` transition.

#### If no results are visible yet

The design can change — as a recorded amendment, never a silent edit:

1. Append a dated entry to the design's `## Amendments` section — what changes and why. The original text above it stays as written.
2. Re-present the amended design in plain terms — the briefing again, scaled to the change — and ask for the explicit go before measurement starts or resumes.

**STOP.** Wait for user response.

**If the user confirms:**

The amendment stands. Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} — design amended"
```

→ Return to caller.

**If the user declines the amendment:**

It doesn't stand — strike its entry (dated); the design holds as approved. Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} — amendment struck"
```

→ Return to caller.

**If the user abandons the experiment instead:**

→ Load **[abandon-experiment.md](abandon-experiment.md)** with id = `{id}`.

→ On return, proceed as the reference directed.

#### If results are visible

The design is frozen permanently. Flaws found now:

- Go in the report's `## Corrections` section — dated, append-only.
- Trigger the *next* experiment, conceived with the fixed design.
- Never re-score old data under new rules — a rule changed after data voids the run, not the data.

An execution deviation is not an amendment: the run departing from the design (harness broke, environment surprised) is logged in the report's Deviations as it happens, and the design stays untouched.

→ Return to caller.
