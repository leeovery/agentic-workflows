# Epic Research Session

*Reference for **[workflow-research-process](../SKILL.md)***

---

## A. Background Agents

Two types of background agent operate during research, and the topic's triage queue surfaces through a third protocol file. Load their instructions now — they run at the appropriate moments during the session loop.

→ Load **[review-agent.md](review-agent.md)** and follow its instructions as written.

→ Load **[deep-dive-agent.md](deep-dive-agent.md)** and follow its instructions as written.

→ Load **[rerouted-concerns.md](../../workflow-shared/references/rerouted-concerns.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research` — a protocol, not a step: the session loop's triage check enters its **A. Check**; nothing runs at load time.

---

## B. Session Loop

Per-topic session with topic awareness and convergence routing.

→ Load **[session-loop.md](session-loop.md)** and follow its conversation process.

---

## C. Topic Awareness

When a concern surfaces that belongs to a *different* topic — raised in conversation, not yet written into this file — flag it rather than letting it accumulate here. (Sustained *written* drift over multiple exchanges triggers the same reroute from **D. Convergence Routing**.) The heuristic: a thread that informs this topic's own question stays here; a concern whose home is a different topic — one that exists, or one that should — isn't this research's to explore.

When a concern reads as off-topic, hold it with the full context discussed about it:

→ Load **[off-topic-epic.md](../../workflow-shared/references/off-topic-epic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research`, concern = `{the concern, with its discussed context}`, reason = `off-topic`.

→ On return, proceed as the reference directed.

---

## D. Convergence Routing

When you notice convergence signals (from the research guidelines), flag it and route to the appropriate action:

#### If a thread has grown into its own topic

Either the session's written material keeps deepening ground that deserves a map topic of its own — sustained accumulation over multiple exchanges, not a clean thematic separation alone — or the user names a thread and asks for it to become a topic.

Hold the thread with the full context worked out about it:

→ Load **[off-topic-epic.md](../../workflow-shared/references/off-topic-epic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research`, concern = `{the thread, with its worked-out context}`, reason = `grown-thread`.

→ On return, proceed as the reference directed.

#### If the current topic is converging (tradeoffs clear, approaching decision territory) or the user indicates they're done

→ Proceed to **E. In-Flight Agent Handling**.

---

## E. In-Flight Agent Handling

Before concluding, check for in-flight agents — run `node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} research {topic}` and read the response's `in_flight` list (agents dispatched but not yet returned). An agent dispatched by an earlier session cannot still be running — each row's `created` timestamp tells you which those are; close each (`agent incorporate`), re-scan, and count only this session's.

#### If no agents are in flight

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.

#### If agents are still running

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render in-flight-agents-gate {work_unit}.research.{topic} --count {N}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `wait`:**

Watch for `agent scan` to promote each in-flight row to `pending`. When none remain in flight, delegate surfacing to the shared protocol loaded by review-agent.md and deep-dive-agent.md. The protocol applies the never-dump rules: two-phase surfacing, one finding at a time. Treat the current moment as a natural break — we are at phase conclusion, so the break check will pass.

→ Return to **B. Session Loop**.

**If `proceed`:**

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.

---

## F. The Experiment Offer

When a number is about to bear a decision — a controlled measurement would settle a choice the conversation is weighing, not merely inform it — offer the laboratory. Hands-on sightings short of that bar stay in the session, labelled exploratory.

→ Load **[experiment-spawn.md](../../workflow-shared/references/experiment-spawn.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research`.

→ On return, proceed as the reference directed.
