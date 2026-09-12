# Session Loop

*Reference for **[workflow-research-process](../SKILL.md)***

---

## The Conversation Rhythm

Not a rigid checklist — a natural cadence for productive research conversations:

1. **Check what landed** — anything waiting is folded before the conversation moves on.

   Check the triage queue first: follow **A. Check** in **[rerouted-concerns.md](../../workflow-shared/references/rerouted-concerns.md)**. Its offer and raise gates end the turn — the dive check below waits for a later iteration; an absorb never ends the turn, the protocol itself continues to the next raise.

   Then, at a natural break — a thread's pause, a synthesis moment, the user's done-signal, or the first iteration of a resumed session — check for landed deep dives: follow **C. Land and Fold** in **[deep-dive-agent.md](deep-dive-agent.md)**. Skip only when no dive has been dispatched — the store decides, not the iteration count: a resumed session may hold dives from an earlier sitting. Mid-thread, defer — a landed report keeps.

2. **Explore** — Probe the topic from a relevant angle. Use the funnel technique: broad first, specific later. Choose your probe type deliberately. One question at a time — wait for the answer before asking the next. A number about to bear a decision — or a measurement thread on the register, a dive's Opened line — is the laboratory's cue: offer it through the session wrapper's **F. The Experiment Offer**.

   A question neither of you can answer from the room, worth more than a lookup, is the deep dive's cue — offer it through **A. Offer** in **[deep-dive-agent.md](deep-dive-agent.md)**. A thread the user is carrying out to the conclusion is not reached, it is handed on: no offer rides a done-signal.

3. **Engage** — Don't just collect the answer. React to it. Challenge assumptions. Explore implications. Follow promising tangents. Connect what the user just said to something from earlier. This is where your value as a research partner lives — you're thinking alongside, not just recording.

4. **Synthesize** — Periodically step back and make sense of what's emerging. "So what I'm hearing is..." or "This connects to what you said earlier about..." Not a scheduled checkpoint — a natural part of the conversation when threads are accumulating. What's becoming clear? What's still uncertain? What patterns are forming?

5. **Document** — At natural pauses, update the research file with insights, open questions, and emerging themes. Capture the substance, not a transcript. The research file is freeform — let structure emerge from the content rather than imposing it.

6. **Commit** — Commit after each write. Don't batch — the commit history is your safety net across context compaction. A deep dive's fold carries the dive's id in the subject — e.g. `research({work_unit}/{topic}): fold launch placement (deep-dive-001)` — and commits alone; unrelated substance commits separately:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic research/{topic} -m "research({work_unit}/{topic}): {what changed}"
   ```

7. **Continue** — Follow the conversation where it leads. If a tangent is promising, pursue it. If a thread is exhausted, move on. If earlier threads gain new context from what was just discussed, circle back.

## The Thread Register

The register is what this topic set out to learn — typed state in the manifest (`phases.research.items.{topic}.threads`), a lens the conversation keeps honest, never a plan: nothing gates on a thread's state, and any state may follow any other. You make every call; the engine `research-threads` verbs record it; the cadence commit carries the change.

- **A thread enters** when the conversation opens a question worth carrying — one this topic will answer or hand to discussion, not every passing curiosity. Origin `user` when the user raised it, `conversation` when the exchange did; `--parent` nests it under the top-level thread it bends (two levels). A rerouted concern enters at its fold — **D. Fold** in **[rerouted-concerns.md](../../workflow-shared/references/rerouted-concerns.md)** — with the rerouting topic's name as its origin:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs research-threads add {work_unit} {topic} {slug} --question "{the question, as asked}" --origin "{origin}" [--parent {slug}]
  ```

- **A thread reframes** when its answer reshapes the question — the normal case, not a correction. The file carries the history; the register carries the question as it now stands:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs research-threads reframe {work_unit} {topic} {slug} --question "{the question, as it now stands}"
  ```

- **A thread is learned** when the conversation has answered it and the file holds the answer; **parked** when the user sets it aside, the reason in one line:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs research-threads set {work_unit} {topic} {slug} learned
  node .claude/skills/workflow-engine/scripts/engine.cjs research-threads set {work_unit} {topic} {slug} parked --note "{why it waits}"
  ```

- **A thread merges** into another when two questions turn out to be one: the survivor's file section carries the folded substance, then `research-threads remove {work_unit} {topic} {slug} --into {survivor}` drops the absorbed row and moves its children under the survivor. A thread a dive is digging is the survivor, never the absorbed one — the fold marks it.

**Render the register once per move, at the natural break that follows it** — a thread learned, parked, added, or reframed since the last render — and when the user asks. An exchange that moved nothing renders nothing, and a state already shown is never shown again for its own sake:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render research-threads {work_unit}.research.{topic}
```

Emit the call's DISPLAY section verbatim per its marker.

## Navigating the Conversation

Guidance on when to go deeper vs move on, when to challenge vs accept, when to synthesize vs keep exploring:

- **Go deeper** when: the user mentions something in passing that sounds important, an answer raises more questions than it answers, you sense the user has more to say but hasn't articulated it yet
- **Move on** when: a thread has been explored from multiple angles and the picture is clear, the user is repeating themselves, the conversation is circling without new insight
- **Challenge** when: something contradicts earlier statements, an assumption is unstated, a risk is being glossed over, the user seems too certain too quickly
- **Synthesize** when: multiple threads are accumulating without connection, the conversation has been divergent for a while, you notice a pattern forming across different topics
- **Bookmark for later** when: something interesting comes up but you're mid-thread on something else — add it to the register as a thread and return when the current thread concludes
