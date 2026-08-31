# Abandon the Experiment

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

Abandonment is a first-class terminal — the register keeps the row and its reason, and nothing is erased. A successor is conceived at the next spawn, from the conversation that still needs the answer.

Take the one-line reason from the conversation — ask when it isn't stated. A parent with live sub-experiments refuses — each ends on its own row first, per the run leg's split walk. Record it, then commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs experiment abandon {work_unit} {topic} {id} --reason "{one line}"
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {id} abandoned"
```

#### If `{id}` is a sub-experiment (`E{n}.{m}`)

The parent still runs, and no wait moves.

→ Return to caller.

#### Otherwise

When the response carries `released_waits`, say in one line where the ball sits: the spawning conversation's wait on this experiment is released, and the abandonment — with its reason — surfaces when it next opens; its waiting point reverts to open.

Re-render the register and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}
```

→ Return to **[the skill](../SKILL.md)** for **Step 7**.
