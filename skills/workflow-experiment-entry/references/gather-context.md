# Gather Context

*Reference for **[workflow-experiment-entry](../SKILL.md)***

---

Completed research can stand in for gathered context. Read the topic's research status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research.{topic} status
```

#### If the status is `completed`

Nothing to gather — the processing skill reads the research at initialisation.

→ Return to caller.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Gather Context`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Collecting initial context to seed the experiment session.
```

Ask each question below **one at a time**. After each, stop and wait for the user's response before proceeding.

> *Output the next fenced block as a code block:*

```
What needs measuring?

- What question should an experiment answer?
- What decision will the answer feed?
```

**STOP.** Wait for user response.

> *Output the next fenced block as a code block:*

```
What do you already know?

- Any prior sightings, numbers, or hunches?
- What do you expect the measurement to show, and why?
```

**STOP.** Wait for user response.

> *Output the next fenced block as a code block:*

```
What would we measure against?

- Which system, process, or artifact is under test?
- Any tools or harnesses already available?
```

**STOP.** Wait for user response.

→ Return to caller.
