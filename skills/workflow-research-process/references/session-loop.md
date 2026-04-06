# Session Loop

*Reference for **[workflow-research-process](../SKILL.md)***

---

## The Conversation Rhythm

Not a rigid checklist — a natural cadence for productive research conversations:

1. **Check for findings** — At natural conversational breaks, check for completed agent results and surface them per the review agent and deep-dive agent instructions loaded by the session wrapper. Skip on the first iteration (no agents have been dispatched yet).

2. **Explore** — Probe the topic from a relevant angle. Use the funnel technique: broad first, specific later. Choose your probe type deliberately. One question at a time — wait for the answer before asking the next.

3. **Engage** — Don't just collect the answer. React to it. Challenge assumptions. Explore implications. Follow promising tangents. Connect what the user just said to something from earlier. This is where your value as a research partner lives — you're thinking alongside, not just recording.

4. **Synthesize** — Periodically step back and make sense of what's emerging. "So what I'm hearing is..." or "This connects to what you said earlier about..." Not a scheduled checkpoint — a natural part of the conversation when threads are accumulating. What's becoming clear? What's still uncertain? What patterns are forming?

5. **Document** — At natural pauses, update the research file with insights, open questions, and emerging themes. Capture the substance, not a transcript. The research file is freeform — let structure emerge from the content rather than imposing it.

6. **Commit & dispatch check** — Git commit after each write. Don't batch. The commit history is your safety net across context compaction. Then immediately evaluate agent dispatch — **CHECKPOINT**: Do not respond to the user until this check is complete. Evaluate the trigger conditions defined in the review agent and deep-dive agent instructions loaded by the session wrapper. If conditions are met, dispatch before continuing. If not, proceed.

7. **Continue** — Follow the conversation where it leads. If a tangent is promising, pursue it. If a thread is exhausted, move on. If earlier threads gain new context from what was just discussed, circle back.

## Navigating the Conversation

Guidance on when to go deeper vs move on, when to challenge vs accept, when to synthesize vs keep exploring:

- **Go deeper** when: the user mentions something in passing that sounds important, an answer raises more questions than it answers, you sense the user has more to say but hasn't articulated it yet
- **Move on** when: a thread has been explored from multiple angles and the picture is clear, the user is repeating themselves, the conversation is circling without new insight
- **Challenge** when: something contradicts earlier statements, an assumption is unstated, a risk is being glossed over, the user seems too certain too quickly
- **Synthesize** when: multiple threads are accumulating without connection, the conversation has been divergent for a while, you notice a pattern forming across different topics
- **Bookmark for later** when: something interesting comes up but you're mid-thread on something else — note it in the research file and return when the current thread concludes
