# Topic Spawning

*Reference for **[epic-session.md](epic-session.md)***

---

**Never decide for the user.** Even if the answer seems obvious, flag it and ask.

A thread of this research has grown into its own topic — either the session's written material keeps deepening ground that deserves a map topic of its own, or the user has named a thread and asked for it to become one. Spawning puts the thread on the discovery map; **content never moves** — the material stays in this research file as the record of what this session explored, and the new topic feeds from it by provenance: its description points here, and its discussion reads this research in full.

For each thread to spawn:

1. Derive a kebab-case `name` from the thread's content, a one-sentence `summary` (drawn from the thread itself) for the discovery item's map renders, and a paragraph or two of `description` — richer context distilled from the thread, naming this research file as where the material lives, loaded as opening context when the topic is later picked up.

2. Judge the new topic's `routing` — `research` by default (the material is research-stage), `discussion` only when the thread is plainly a decision already framed and needing no further exploration.

3. Offer the spawn. Write the payload to `.workflows/.cache/{work_unit}/research/{topic}/spawn-offer.json` with the Write tool (`{"thread": "…", "name": "…"}` — the thread's short title and the derived name), then render it:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render spawn-offer {work_unit}.research.{topic} --file .workflows/.cache/{work_unit}/research/{topic}/spawn-offer.json
   ```

   Emit the call's MENU section verbatim per its marker.

   **STOP.** Wait for user response.

   **If `no`:**

   The thread stays part of this topic. Continue the loop with the next thread, or when none remain:

   → Return to caller.

   **If `yes`:**

   → Load **[create-discovery-topic.md](../../workflow-shared/references/create-discovery-topic.md)** with work_unit = `{work_unit}`, proposed_name = `{name}`, routing = `{routing}`, source = `spawn:{topic}`, summary = `{summary}`, description = `{description}`.

   **If `result` is `cancelled`:**

   Abandon this thread and continue the loop with the next.

   **Otherwise:**

   The topic is on the map. Continue the loop with the next thread.

Once every thread has been processed, commit the manifest writes:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic research/{topic} -m "research({work_unit}/{topic}): spawn {N} topic(s)"
```

→ Return to caller.
