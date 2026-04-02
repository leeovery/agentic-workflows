# Background Sub-Agents in Research

## The Idea

During research sessions, allow the research skill to dispatch sub-agents for independent research threads in the background while the main conversation continues. The user and Claude keep exploring topics together while heavy research tasks (web searches, source code reviews, API documentation analysis) run in parallel.

## Why This Matters

Research sessions naturally generate multiple independent threads. Currently, the research skill processes everything sequentially — if the user wants to explore Bluetooth APIs, review a competitor's source code, and investigate networking options, each thread blocks the others.

In a real-world research conversation between two people, one person might say "let me look that up while we keep talking." That's exactly what background sub-agents enable. The conversation stays fluid and productive while deep research runs in parallel.

## Observed Behaviour (Real Session)

This idea emerged from a live research session (trackpad-switcher-mvp epic, 2026-04-01) where background agents were used organically during research — not because the skill instructed it, but because the pattern fit naturally:

1. **Networking research** — dispatched as a background agent while the main conversation continued exploring automation triggers and UX concepts. Results came back ~8 minutes later with a comprehensive 560-line analysis.
2. **Blue Switch code review** — cloned the repo and dispatched a background agent to review all source files while continuing the conversation.
3. **Bluetooth pairing behavior** — dispatched in parallel with the Blue Switch review, researching a completely independent technical question.

The pattern worked well because:
- The main conversation never stalled waiting for research results
- The user and Claude continued exploring ideas, refining concepts, and documenting findings
- When results arrived, they were naturally integrated into the conversation
- Three independent research threads completed in the time one sequential thread would have taken

## What It Would Look Like

The research skill's session loop or guidelines would explicitly acknowledge this pattern:

- When a research thread is independent and would benefit from deep web research or code analysis, offer to dispatch it as a background sub-agent
- Continue the conversation on other threads while the agent works
- When results arrive, summarise findings and integrate into the research document
- Commit results as they land, not batched at the end

## Design Tensions

- **Context sharing**: Sub-agents don't see the ongoing conversation. They need self-contained briefs with enough context to do useful work. The main agent must compose good prompts.
- **File conflicts**: Multiple agents writing to the same research file would cause problems. Each agent should write to its own file (e.g., `networking.md`, `blue-switch-review.md`) rather than appending to a shared document.
- **Notification handling**: When a background agent completes mid-conversation, the main agent needs to handle the notification naturally without disrupting the current thread.
- **Over-delegation**: Not everything should be a sub-agent. Quick lookups, single API checks, or questions that inform the next conversational turn should stay in the main thread. Sub-agents are for substantial, independent research that would take multiple minutes.
- **Skill boundary**: This pattern uses the Agent tool which is always available. The skill doesn't need to "enable" it — but explicitly acknowledging the pattern in the research guidelines would make it a deliberate part of the process rather than an ad-hoc decision.
