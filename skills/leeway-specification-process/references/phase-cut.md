# The Phase Cut

*Reference for **[leeway-specification-process](../SKILL.md)***

---

The cut lists the build's phases in order, made from the spec's outline and the graph of what its parts rely on. Its moves:

1. Brief the cut's agent, then make the Agent call — its `subagent_type` the agent `brief` answers, its prompt the pointer alone — and wait for its status:

   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs brief phase-cut {work_unit}
   ```

2. Land the cut it staged:

   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs cut {work_unit}
   ```

   A refusal goes back to the agent: brief it again — the fresh brief carries the refusal — and call it again. The cut is the agent's alone, never yours to amend.

3. Each concern its status names, a line of the spec it could not cut by, is a gap, raised as **Gaps** in **[writing-and-review.md](writing-and-review.md)** says; once it is answered, the writer's land and the review's pass come before the cut again.
