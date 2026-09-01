# Validate the Series

*Reference for **[workflow-experiment-entry](../SKILL.md)***

---

Branch on the `series_state` the caller passed — no re-read. Both states end here: the spawn is the phase's one door, and this skill only ever enters a series that already exists.

#### If `series_state` is `missing`

> *Output the next fenced block as a properties code block (```properties fence):*

```
⚑ No experiment series exists for this topic
```

> *Output the next fenced block as markdown (not a code block):*

```
> Experiments are spawned from a research or discussion session. Raise the question in the conversation that needs it measured.
```

**STOP.** Do not proceed — terminal condition.

#### If `series_state` is `cancelled`

> *Output the next fenced block as a properties code block (```properties fence):*

```
⚑ The experiment series for this topic is cancelled
```

> *Output the next fenced block as markdown (not a code block):*

```
> The series' rows stand on the register; a new spawn from the topic's research or discussion starts the next experiment — reopen that conversation first if it has concluded.
```

**STOP.** Do not proceed — terminal condition.
