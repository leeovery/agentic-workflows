# Background Sub-Agents in Research

## The Idea

During research sessions, allow the research skill to dispatch sub-agents for independent research threads in the background while the main conversation continues. The user and Claude keep exploring topics together while heavy research tasks (web searches, source code reviews, API documentation analysis) run in parallel.

This must be a declared, controlled feature — not something that happens ad-hoc. The skill must own the lifecycle: when agents are dispatched, what files they create, and critically, that those files are registered in the manifest.

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

### What Went Wrong

The sub-agents created research files (`networking.md`, `rule-engine.md`, `blue-switch-review.md`, `bluetooth-pairing-behavior.md`) directly in the research directory without registering them in the manifest via `init-phase`. This left the workflow in an inconsistent state — files existed on disk that the manifest didn't know about.

This happened because:
- The Agent tool is always available — Claude used it as a general capability, not as part of the skill's process
- The sub-agents had no awareness of the manifest or the registration requirement
- The main agent didn't register the files on behalf of the sub-agents when results came back
- The compliance check at the end of the session didn't catch the unregistered files

## What It Would Look Like

The research skill's session loop or guidelines would explicitly declare this as a feature:

### Dispatching

- When a research thread is independent and would benefit from deep web research or code analysis, offer to dispatch it as a background sub-agent
- Before dispatching, the main agent MUST register the new topic in the manifest:
  ```bash
  node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{topic}
  ```
- The sub-agent brief must include the exact output file path
- Continue the conversation on other threads while the agent works

### On Completion

- When results arrive, summarise findings and integrate into the conversation
- Commit the sub-agent's file
- Verify the file matches the registered manifest entry

### Sub-Agent Brief Requirements

Sub-agents must receive:
- The exact output file path (`.workflows/{work_unit}/research/{topic}.md`)
- The research document template to follow
- Enough context to do useful work without the conversation history
- Clear instruction NOT to modify any other research files

### Guardrails

- Sub-agents write to their OWN file only — never the main exploration file or other topic files
- The main agent is responsible for manifest registration, not the sub-agent
- Quick lookups, single API checks, or questions that inform the next conversational turn stay in the main thread — sub-agents are for substantial, independent research
- Maximum concurrent sub-agents should be reasonable (3-4) to avoid overwhelming the session with notifications

## Compliance Check Updates

The existing compliance check (`compliance-check.md`) should be extended with:

1. **File-manifest consistency** — scan `.workflows/{work_unit}/research/` for any `.md` files that are NOT registered in the manifest. Flag unregistered files as a significant issue requiring correction.
2. **Sub-agent file verification** — if sub-agents were dispatched during the session, verify each created file is registered and committed.
3. **Template compliance** — verify sub-agent-created files follow the research document template structure.

## Design Tensions

- **Context sharing**: Sub-agents don't see the ongoing conversation. They need self-contained briefs with enough context to do useful work. The main agent must compose good prompts.
- **File conflicts**: Multiple agents writing to the same research file would cause problems. Each agent should write to its own file rather than appending to a shared document.
- **Notification handling**: When a background agent completes mid-conversation, the main agent needs to handle the notification naturally without disrupting the current thread.
- **Over-delegation**: Not everything should be a sub-agent. The threshold should be high — substantial research that would take multiple minutes and is independent of the current conversation thread.
- **Manifest as source of truth**: The manifest must always reflect reality. If a file exists, it must be registered. This is the core invariant that was violated in the observed session and the primary thing the skill must enforce.
