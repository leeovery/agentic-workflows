# Feature Research Session

*Reference for **[workflow-research-process](../SKILL.md)***

---

## A. Background Agents

Two types of background agent operate during research. Load their lifecycle instructions now — apply them at the appropriate moments during the session loop.

→ Load **[review-agent.md](review-agent.md)** and follow its instructions as written.

→ Load **[deep-dive-agent.md](deep-dive-agent.md)** and follow its instructions as written.

---

## B. Session Loop

Focused, single-topic session. No splitting, no multi-file management.

→ Load **[session-loop.md](session-loop.md)** and follow its conversation process.

---

## C. Session Conclusion

When the topic feels well-explored or the user indicates they're done:

→ Proceed to **D. In-Flight Agent Handling**.

---

## D. In-Flight Agent Handling

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

Check for agent completion. When all agents have returned, delegate surfacing to the shared protocol loaded by review-agent.md and deep-dive-agent.md. The protocol applies the never-dump rules: two-phase surfacing, one finding at a time. Treat the current moment as a natural break — we are at phase conclusion, so the break check will pass.

→ Return to **B. Session Loop**.

**If `proceed`:**

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.
