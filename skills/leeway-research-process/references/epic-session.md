# Epic Research Session

*Reference for **[workflow-research-process](../SKILL.md)***

---

## A. Background Agents

One kind of background agent operates during research — the deep dive — and two protocol files cover the topic's mailbox and the files the user shares. Load their instructions now — they run at the appropriate moments during the session loop.

→ Load **[deep-dive-agent.md](deep-dive-agent.md)** and follow its instructions as written.

→ Load **[reading-the-mailbox.md](../../workflow-shared/references/reading-the-mailbox.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research` — a protocol, not a step: the session loop's mailbox check enters its **A. Check**; nothing runs at load time.

→ Load **[landing-shared-files.md](../../workflow-shared/references/landing-shared-files.md)** with work_unit = `{work_unit}`, origin = `research/{topic}` — a protocol, not a step: the session loop enters its **A. Land It** when the user offers a path; nothing runs at load time.

---

## B. Session Loop

Per-topic session with topic awareness and convergence routing.

→ Load **[session-loop.md](session-loop.md)** and follow its conversation process.

---

## C. Topic Awareness

When a point surfaces that belongs to a *different* topic — raised in conversation, not yet written into this file — flag it rather than letting it accumulate here. (Sustained *written* drift over multiple exchanges triggers the same send from **D. Convergence Routing**.) The heuristic: a thread that informs this topic's own question stays here; a point whose home is a different topic — one that exists, or one that should — isn't this research's to explore.

When a point reads as off-topic, hold it with the full context discussed about it:

→ Load **[off-topic-epic.md](../../workflow-shared/references/off-topic-epic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research`, point = `{the point, with its discussed context}`, reason = `off-topic`.

→ On return, proceed as the reference directed.

---

## D. Convergence Routing

When you notice convergence signals (from the research guidelines), flag it and route to the appropriate action:

#### If a thread has grown into its own topic

Either the session's written material keeps deepening ground that deserves a map topic of its own — sustained accumulation over multiple exchanges, not a clean thematic separation alone — or the user names a thread and asks for it to become a topic.

Hold the thread with the full context worked out about it — its children's questions travel in that context — and name its slug: once the message is sent, the reference drops its rows; on `keep` they stay:

→ Load **[off-topic-epic.md](../../workflow-shared/references/off-topic-epic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research`, point = `{the thread, with its worked-out context}`, reason = `grown-thread`, slug = `{slug}`.

→ On return, proceed as the reference directed.

#### If the user's sign-off leaves the topic open

Stepping away for the day, picking it up next time — a pause, not a done-signal. Commit what the exchange left and end the turn.

→ Return to **B. Session Loop**.

#### If the current topic is converging (tradeoffs clear, approaching decision territory) or the user indicates the topic is done

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.

---

## E. The Experiment Offer

When a number is about to bear a decision — a controlled measurement would settle a choice the conversation is weighing, not merely inform it — offer the laboratory. Hands-on sightings short of that bar stay in the session, labelled exploratory.

→ Load **[experiment-spawn.md](../../workflow-shared/references/experiment-spawn.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research`.

→ On return, proceed as the reference directed.
