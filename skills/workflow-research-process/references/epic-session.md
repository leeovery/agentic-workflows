# Epic Research Session

*Reference for **[workflow-research-process](../SKILL.md)***

---

## A. Background Agents

Two types of background agent operate during research. Load their lifecycle instructions now — apply them at the appropriate moments during the session loop.

→ Load **[review-agent.md](review-agent.md)** and follow its instructions as written.

→ Load **[deep-dive-agent.md](deep-dive-agent.md)** and follow its instructions as written.

---

## B. Session Loop

Per-topic session with topic awareness and convergence routing.

→ Load **[session-loop.md](session-loop.md)** and follow its conversation process.

---

## C. Topic Awareness

When a concern surfaces that belongs to a *different* topic — raised in conversation, not yet written into this file — flag it rather than letting it accumulate here. (Sustained *written* drift over multiple exchanges is the separate split signal — see **D. Convergence Routing**.)

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{concern}** belongs to a different topic, not this one.

- **`r`/`reroute`** — Send it to the topic it belongs to; it picks it up later
- **`k`/`keep`** — Keep exploring here for now
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `reroute`:**

1. Identify the topic the concern belongs to. Read the live map:

   ```bash
   node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
   ```

   Resolve the target. If one topic clearly matches, propose it and confirm with the user. If nothing fits, propose a new kebab-case name and confirm. If several plausible candidates exist — or a near-match you're unsure of — present them and let the user choose:

   > *Output the next fenced block as markdown (not a code block):*

   ```
   · · · · · · · · · · · ·
   Where should "{concern}" land?

   - **`1`** — {candidate} [{state}]
   - **`2`** — {candidate} [{state}]
   - **`n`/`new`** — Create a new topic for it
   · · · · · · · · · · · ·
   ```

   **STOP.** Wait for user response.

   A chosen candidate is the target; `new` means propose a kebab-case name and confirm it. If the resolved target is the current topic, it's not a reroute — fold it into this research file as a thread and → Return to **B. Session Loop**.

2. Record the concern with the full context discussed about it as `concern` — the target topic picks it up cold.

3. Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{concern}`, origin = `{topic}`, phase = `research`, date = `{today}`. If `result` is `cancelled`, nothing landed — → Return to **B. Session Loop**. Otherwise the concern landed in `{landed_topic}`'s `## Triage`.

4. Commit:

   ```bash
   git add -- .workflows/{work_unit}/
   git commit -m "research({work_unit}/{topic}): reroute concern to {landed_topic}"
   ```

→ Return to **B. Session Loop**.

**If `keep`:**

Keep exploring here. If written material keeps accumulating off-topic over multiple exchanges, the split path in **D. Convergence Routing** moves it out.

→ Return to **B. Session Loop**.

---

## D. Convergence Routing

When you notice convergence signals (from the research guidelines), flag it and route to the appropriate action:

#### If sustained off-topic content has accumulated over multiple exchanges in this session

The current file is drifting — multiple exchanges have been adding material that doesn't belong under this topic's name. This is the trigger to split, not a clean thematic separation alone.

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

Check for agent completion. When all agents have returned, delegate surfacing to the shared protocol loaded by review-agent.md and deep-dive-agent.md. The protocol applies the never-dump rules: two-phase surfacing, one finding at a time. Treat the current moment as a natural break — we are at phase conclusion, so the break check will pass.

→ Return to **B. Session Loop**.

**If `proceed`:**

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.
