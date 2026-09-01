# Conclude the Experiment

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

## A. Complete the Report

Complete `{dir}/report.md`: the reading (kept separate from the results it reads), the conclusion executing the pre-registered decision rule — which branch fired and what it triggers, never a fresh judgment — and the reproduce notes. A measure conceived after seeing the data is labelled **exploratory** — it can motivate the next experiment, never settle this one. A parent's conclusion synthesises its sub-experiments' verdicts.

Walk the user through what was measured and what the rule says it means — the verdict is the rule's outcome; the spawning conversation decides what to do with it.

→ Proceed to **B. Record the Verdict**.

## B. Record the Verdict

Record the verdict — one line, the decision rule's outcome:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment conclude {work_unit} {topic} {id} --verdict "{one line}"
```

#### If the engine refused over a live sub-experiment

Its row ends first — the split walk finishes the open sub, and this conclude re-runs after.

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

#### If the engine refused for any other reason

Nothing was recorded — no verdict, no commit, no release to narrate. Say why in one line, fix what it names (a multi-line verdict becomes its one-line outcome), and re-run.

→ Return to **A. Complete the Report**.

#### Otherwise

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} concluded"
```

When the conclude response carried `released_waits`, say in one line where the ball sits: the spawning conversation's wait on this experiment is released, and the evidence surfaces when it next opens. When it carried `reconcile_flagged`, name the flagged item the same way — evidence arrived after its decision, and its next entry reconciles.

Re-render the register — the series moved — and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}
```

→ Return to caller.
