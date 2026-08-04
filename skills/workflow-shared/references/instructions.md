# Instructions

*Shared reference for all workflow skills. Loaded via [framework.md](framework.md).*

---

Follow these steps EXACTLY as written. Do not skip steps or combine them. Present output using the EXACT format shown in examples — do not simplify or alter the formatting.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Even if the user's initial prompt seems to answer a question, still confirm with them at the appropriate step
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate gate-mode `auto` value in the manifest (`*_gate_mode`, or a loop's `staging`/`analysis_staging` `gate_mode`), set by the user's explicit `a/auto` choice at a prior gate — in phases with no such gate, every STOP always stops.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- Don't invent stops. Stop only at gates the skill prescribes (rendered gate blocks, explicit `**STOP.**` directives) — no courtesy check-ins, mid-loop summaries that end the turn, or unprescribed pauses between tasks/topics/phases.
- Don't invent approvals. A gate's consent covers only material already surfaced at that gate — never solicit approval that spans gates not yet reached ("shall I do all N?"), and never treat an answer to such a question as consent for unseen items. A question broad enough to pre-answer a later STOP is the same violation as skipping it.
- Work artifacts record their topic's substance — never the workflow around them. Beyond the markers a flow prescribes (provenance lines, `Sibling check:`, finding ids, revision timestamps), no process observations, documentation conventions, or lessons about how a session ran land in an artifact: the pipeline is not the topic.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next

→ Return to caller.
