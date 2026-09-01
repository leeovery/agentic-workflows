# Experiment Spawn

*Shared reference. Loaded by the research and discussion sessions when a number is about to bear a decision.*

---

The caller provides `work_unit`, `topic`, and `phase` (`research` or `discussion` — the session's own). The conversation has hit a point where a controlled measurement would settle a choice being weighed. Offer the laboratory; on yes, record the spawn right here, while the conversation still holds the knowledge.

## A. The Offer

The bar: a number about to **bear a decision** — not every curiosity. Hands-on poking stays legitimate and stays in the session; the offer is owed only when a measurement is going to carry decision-bearing weight.

Offer conversationally, in the session's own voice — never a script, never a menu: name the question a controlled experiment would settle, what a dependable answer takes off the table, and that an ad-hoc inline measurement is a fine alternative. Declining is always valid.

**STOP.** Wait for user response.

#### If the user declines

Continue the conversation. An inline measurement, no ceremony, stays part of the record — labelled **exploratory** wherever it lands in the document, so it never carries weight it was not built for.

→ Return to caller for **B. Session Loop**.

#### If the user accepts

→ Proceed to **B. Record the Spawn**.

## B. Record the Spawn

1. Write the problem statement to the session's cache scratch, `.workflows/.cache/{work_unit}/{phase}/{topic}/problem.md` — the problem in plain terms: what we need to pick or learn, the space around it, what we hope. Close with a provenance line naming where it was born — `Spawned from the "{topic}" {phase}, at {the point, in a few words}, on {today}.` **No design content** — no hypothesis, no prediction, no decision rule, no setup. The spawning phase is the client at the laboratory door: it states the problem and stops; question refinement, prediction, decision rule, and method are all the laboratory's.

2. Derive a kebab-case slug from the problem, then allocate the record — the create installs the scratch as the record's `problem.md`, and the response's `id` is the experiment (`E{n}`) and `dir` its directory. The same transaction locks this conversation's item: `awaiting_experiments` gains the id, and the topic cannot conclude until the wait releases:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs experiment create {work_unit} {topic} --slug {slug} --from {phase} --problem .workflows/.cache/{work_unit}/{phase}/{topic}/problem.md
   ```

   A refused create records nothing — no id, no lock, and the scratch survives. Say why in one line and skip the note and both commits:

   → Return to caller for **B. Session Loop**.

3. Note the handed-off question in the session's own document — a dated entry at the waiting point the evidence returns to, named as awaiting `{id}` — and commit with the session's cadence:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic {phase}/{topic} -m "{phase}({work_unit}/{topic}): spawn {id} {slug}"
   ```

4. Commit the record — `--sweep`, because the experiment topic is the laboratory's, not this session's: the spawn hands the question over, it never claims the slot:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} --sweep -m "experiment({work_unit}/{topic}): {id} problem statement"
   ```

→ Proceed to **C. Now or Later**.

## C. Now or Later

Fetch the gate and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-spawn-gate {work_unit}.{phase}.{topic} --id {id}
```

**STOP.** Wait for user response.

#### If `now`

The session pauses mid-phase — no closing ceremony, no document review, no completion: the conversation concludes once the evidence lands. Everything is already committed; say where the ball sits:

> *Output the next fenced block as markdown (not a code block):*

```
> Paused with {id} queued — the closing ceremony is skipped, and this conversation concludes once the evidence lands. The laboratory starts in fresh context: run `/clear`, then `/workflow-start` — the menu carries the way into {id}.
```

**STOP.** Do not proceed — terminal condition.

#### If `later`

The conversation continues where it left off. Conclusion stays blocked until `{id}`'s evidence lands — the conclusion flow surfaces the wait if concluding is attempted first, and the session pauses at its natural end the same way.

→ Return to caller for **B. Session Loop**.
