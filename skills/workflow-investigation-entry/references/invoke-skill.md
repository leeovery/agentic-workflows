# Invoke the Skill

*Reference for **[workflow-investigation-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill. The handoff carries session identity plus any interview answers — the durable carrier (manifest `description` + session log) is read by the processing skill at initialisation, never added to the handoff.

---

## Handoff

#### If source is `new` and gather-context ran at Step 3

Fill the Bug context from the `gather-context` answers — it primes the process, not a full report; `workflow-investigation-process` does the deep symptom gathering (Step 3) and a knowledge-base query (Step 4):

Invoke the **workflow-investigation-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Investigation session for: {work_unit}

Output: .workflows/{work_unit}/investigation/{topic}.md

Bug context:
- Expected behavior: {from gather-context}
- Actual behavior: {from gather-context}
- Initial context: {error messages, reproduction steps — from gather-context, or "(none captured yet)"}
```

#### If source is `new` and gather-context did not run

Invoke the **workflow-investigation-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Investigation session for: {work_unit}

Output: .workflows/{work_unit}/investigation/{topic}.md
```

#### If source is `continue`

Invoke the **workflow-investigation-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Investigation session for: {work_unit}

Source: existing investigation
Output: .workflows/{work_unit}/investigation/{topic}.md
```
