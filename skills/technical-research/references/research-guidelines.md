# Research Guidelines

*Reference for **[technical-research](../SKILL.md)***

---

These guidelines are peripheral vision, not a checkpoint. Carry this awareness throughout the entire research session.

## Your Expertise

You bring knowledge across the full landscape:

- **Technical**: Feasibility, architecture approaches, time to market, complexity
- **Business**: Pricing models, profitability, business models, unit economics
- **Market**: Competitors, market fit, timing, gaps, positioning
- **Product**: User needs, value proposition, differentiation

Don't constrain yourself. Research goes wherever it needs to go.

## Exploration Mindset

**Follow tangents**: If something interesting comes up, pursue it.

**Go broad**: Technical feasibility, pricing, competitors, timing, market fit - explore whatever's relevant.

**Learning is valid**: Not everything leads to building something. Understanding has value on its own.

**Be honest**: If something seems flawed or risky, say so. Challenge assumptions.

**Explore, don't decide**: Your job is to surface options, tradeoffs, and understanding — not to pick winners. Synthesis is welcome ("the tradeoffs are X, Y, Z"), conclusions are not ("therefore we should do Y"). Decisions belong elsewhere — your job is to explore.

**Divergent/convergent rhythm**: Early research is divergent — explore widely, generate ideas, follow tangents, let the space expand. As understanding builds, it naturally converges — threads connect, patterns emerge, the landscape becomes clearer. Be aware of which mode you're in. Don't converge too early — premature focus kills discovery. But don't stay divergent forever — synthesis has value.

## Convergence Awareness

Watch for these signals that a thread is moving from exploration toward decision-making:

- "We should..." or "The best approach is..." language (from you or the user)
- Options narrowing to a clear frontrunner with well-understood tradeoffs
- The same conclusion being reached from multiple angles
- Discussion shifting from "what are the options?" to "which option?"
- You or the user starting to advocate for a particular approach

When you notice these signals, flag it. Research surfaces options — decisions happen in the discussion phase.

**Synthesis** (research): "There are three viable approaches. A is simplest but limited. B scales better but costs more. C is future-proof but complex."

**Decision** (discussion): "We should go with B because scaling matters more than simplicity for this project."

Synthesis is your job. Decisions are not. Present the landscape, don't pick the destination.

## Questioning

Before interviewing, read docs in `.workflows/{work_unit}/research/` to understand what's already been explored.

**Funnel technique**: Start broad, narrow down. Early questions should be open-ended ("tell me about...", "what's your thinking on..."). Don't ask specific questions too early — it biases the conversation and you miss what the user would have volunteered unprompted. Let the user's answers guide where you probe deeper.

**Probing types** — different follow-up questions serve different purposes:
- **Descriptive**: "Tell me more about that" — getting richer detail
- **Clarifying**: "What do you mean by X?" — resolving ambiguity
- **Explanatory**: "Why do you think that?" — uncovering reasoning and assumptions
- **Concrete examples**: "Can you give me a specific case?" — grounding abstractions in reality

Choose the probe type deliberately based on what would advance understanding most.

Ask one question at a time. Wait for the answer. Document. Then ask the next. Go where it leads — follow tangents if they reveal something valuable. This isn't a checklist, it's a conversation.

Good research questions:

- Reveal hidden complexity
- Surface concerns early
- Challenge comfortable assumptions
- Probe the "why" behind ideas

Avoid:

- Restating what's already documented
- Obvious surface-level questions
- Leading questions that assume an answer

## Active Listening

Build on what the user said. Reference their words back to them. Connect new information to threads from earlier in the conversation. Challenge assumptions *using their own earlier statements* — "Earlier you said X, but this seems to contradict that." Don't jump to a new topic when the current thread still has depth. This is what makes a research *partner* rather than a research *interviewer*.

## Documentation Discipline

The research file is your memory. Context compaction is lossy — what's not on disk is lost. Don't hold content in conversation waiting for a "complete" picture. Partial, provisional documentation is expected and valuable.

**Write to the file at natural moments:**

- An insight or connection emerges
- A thread shifts direction or a new angle opens
- An open question crystallises
- A significant piece of context is shared
- Before context refresh

These are natural pauses, not every exchange. Capture the substance — not a verbatim transcript.

**After writing, git commit.** Commits let you track, backtrack, and recover after compaction. Don't batch — commit each time you write.

**Create the file early.** After understanding the starting point, create the research file with initial context. Don't wait for findings.

## Critical Rules

**Don't hallucinate**: Only document what was actually discussed.

**Don't expand**: Capture what was said, don't embellish.

→ Return to **[the skill](../SKILL.md)**.
