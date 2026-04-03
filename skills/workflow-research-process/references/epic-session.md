# Epic Research Session

*Reference for **[workflow-research-process](../SKILL.md)***

---

## A. Background Agents

Two types of background agent operate during research. Load their lifecycle instructions now — apply them at the appropriate moments during the session loop.

→ Load **[review-agent.md](review-agent.md)** and follow its instructions as written.

→ Load **[deep-dive-agent.md](deep-dive-agent.md)** and follow its instructions as written.

---

## B. Session Loop

Multi-file, topic-aware session with convergence routing.

→ Load **[session-loop.md](session-loop.md)** and follow its conversation process.

---

## C. Topic Awareness

When working in a specific topic file and content drifts to another topic's scope, flag it and offer to switch to that topic's file or note it for later. Don't silently let content accumulate in the wrong file.

---

## D. Convergence Routing

When you notice convergence signals (from the research guidelines), flag it and route to the appropriate action:

#### If threads are emerging as distinct topics (different scopes, stakeholders, or timelines)

→ Load **[topic-splitting.md](topic-splitting.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.

#### If the current topic is converging (tradeoffs clear, approaching decision territory)

→ Proceed to **E. In-Flight Agent Handling**.

---

## E. In-Flight Agent Handling

Before concluding, check for in-flight agents. Scan the cache directory for review or deep-dive files with `status: pending` in their frontmatter.

#### If no agents are in flight

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.

#### If agents are still running

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
There are still {N} background agents working.

- **`w`/`wait`** — Wait for results before concluding
- **`p`/`proceed`** — Conclude now (results will persist in cache for reference)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `wait`:**

Check for agent completion. When all agents have returned, surface their findings per the agent instructions loaded above.

→ Return to **B. Session Loop**.

**If `proceed`:**

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.
