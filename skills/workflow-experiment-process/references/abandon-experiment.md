# Abandon the Experiment

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

Abandonment is a first-class terminal — the register keeps the row and its reason, and nothing is erased. A successor is conceived at the next spawn, from the conversation that still needs the answer.

## A. Record the Reason

Take the one-line reason from the conversation — ask when it isn't stated. Record it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment abandon {work_unit} {topic} {id} --reason "{one line}"
```

#### If the engine refused over live sub-experiments

The parent is mid-split — each sub ends on its own row first.

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

#### If the engine refused for any other reason

Nothing was recorded — no row closed, no commit, no release to narrate. Say why in one line, fix what it names (a multi-line reason becomes one line), and re-run.

→ Return to **A. Record the Reason**.

#### If `{id}` is a sub-experiment (`E{n}.{m}`)

The parent still runs, and no wait moves. Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} abandoned"
```

→ Return to caller.

#### Otherwise

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} abandoned"
```

When the abandon response carried `released_waits`, say in one line where the ball sits: the spawning conversation's wait on this experiment is released, and the abandonment — with its reason — surfaces when it next opens; its waiting point reverts to open.

Re-render the register and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}
```

→ Return to **[the skill](../SKILL.md)** for **Step 6**.
