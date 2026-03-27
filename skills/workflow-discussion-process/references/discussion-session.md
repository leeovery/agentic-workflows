# Discussion Session

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

## Background Agents

Two types of background agent operate during the discussion. Load their lifecycle instructions now — apply them at the appropriate moments during the session loop.

→ Load **[review-agent.md](review-agent.md)** and follow its instructions as written.

→ Load **[perspective-agents.md](perspective-agents.md)** and follow its instructions as written.

---

## Session Loop

The discussion is a conversation. Follow this loop:

1. **Check for findings** — At natural conversational breaks, check for completed agent results and surface them. Skip on the first iteration (no agents have been dispatched yet).
2. **Discuss** — Engage with the user on the current question or topic. Challenge thinking, push back, explore edge cases. Participate as an expert architect.
3. **Document** — At natural pauses, update the discussion file with decisions, debates, options explored, and rationale. Use the per-question structure from the template (Context → Options → Journey → Decision).
4. **Commit** — Git commit after each write. Don't batch.
5. **Consider agents** — After each substantive commit, evaluate the trigger conditions defined in the review agent and perspective agent instructions loaded above. If conditions are met, follow their dispatch instructions.
6. **Repeat** — Continue with the next question or follow where the conversation leads.

---

## Per-Question Approach

**Per-question structure** keeps the reasoning contextual. Options considered, false paths, debates, and "aha" moments belong with the specific question they relate to - not as separate top-level sections. This preserves the journey alongside the decision.

Work through questions one at a time. For each:

- Explore options and trade-offs
- Capture the journey — false paths, debates, what changed thinking
- Document the decision and rationale when reached
- Check off completed questions in the Questions list

---

## When the User Signals Conclusion

When the user indicates they want to conclude the discussion (e.g., "that covers it", "let's wrap up", "I think we're done"):

Check for in-flight agents. If agents are still running:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
There are still {N} background agents working.

- **`w`/`wait`** — Wait for results before concluding
- **`p`/`proceed`** — Conclude now (results will persist in cache for reference)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `wait`

Check for agent completion. When all agents have returned, check for findings and surface them.

→ Return to **Session Loop**.

#### If `proceed`

→ Return to caller.

#### If no agents are in flight

→ Return to caller.
