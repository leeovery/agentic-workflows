# Routing Commit

*Reference for **[workflow-discovery-process](../SKILL.md)***

---

The moment shape commits — moving from *"I have an opinion"* to *"we've committed"*. Covers macro routing (what kind of work this is) and, for work types that have it, micro routing (per-topic research vs discussion). Loaded from [topic-synthesis.md](topic-synthesis.md) and from the loop in [session-loop.md](session-loop.md) when commit conditions are met.

## A. State the Read

Say what the shape is in plain user-facing terms, with the workflow bucket name folded in naturally — not before. Example:

> *"This is feature-shaped — one focused thing to build. The routing tendency I'm reading is discussion since the shape is clear and the open questions are about trade-offs not unknowns."*

The bucket name (*"feature-shaped"*) appears alongside the substance description, not in place of it.

## B. Explain the Reasoning

The user needs to be informed enough to agree or push back. Surface the specific signals that drove the read:

- **Brief** — one or two sentences. The point is to make the read auditable, not to defend it.
- **Specific** — name the cues (*"because you described X and Y as separate concerns and each came with substantive weight"*), not vague (*"based on the conversation"*).
- **Pull-on-able** — the user can challenge specific cues, not just accept-or-reject the whole conclusion. Saying *"because you described X and Y as separate concerns"* lets the user respond *"actually X and Y are the same thing — Y is a subset"* — take that as an update to the read.

This is the difference between *"trust me"* reasoning and *"check my work"* reasoning. Use the latter.

When you don't have enough signal to give pull-on-able reasoning, that's the trigger to keep exploring rather than surface a read — the read isn't ready yet.

## C. Invite Confirmation or Override

Use AskUserTool for the routing-commit moment. Structured confirm-or-override locks the call cleanly without ambiguity and matches the formality of a commit. The user sees the proposed routing, the reasoning, and structured options:

- **Confirm** — accept the proposed shape and routing
- **Override** — pick a different shape (the alternative the user has in mind)
- **Discuss more** — return to exploration before committing

AskUserTool is the right surface here because:

- The commit is a structured decision, not a conversational nudge
- Override needs a clean affordance, not a free-text pushback that risks ambiguity
- The user benefits from seeing the proposal and the alternatives side by side

## D. Honour User Override Authoritatively

If the user pushes back, take their call as final. No re-litigation. If the user redirects to a different shape, adjust without needing further justification — the override is the authoritative input, not a negotiation opener.

If the override creates a routing conflict (e.g. user overrides epic → feature, but Discovery has accumulated three candidate topics), surface the implication and ask one clarifying question (*"that pushes us to a single feature — which of these three threads is the focus?"*) rather than silently dropping signal.

## E. Patience on the Commit

Even when signals have reached the surfacing threshold (see [shape-detection.md](shape-detection.md) section C), hold off committing until:

- Signals have **converged AND been stable** across the last few exchanges — not just hit threshold this turn
- Mid-loop tentative surfacings have been **confirmed or adjusted** by the user
- The natural next move would **drop into content** if we kept exploring — the shape conversation has truly run as far as it can without violating the shape-vs-content guardrail
- The user's framing has been **consistent** — not about to revert the commit in two turns

This is the same patience discipline as the surfacing threshold, applied one step later in the loop. Substance-focus enables it: stay on what's being built / fixed / changed, not on which bucket it lands in, and the commit lands when it's actually ready.

## F. Operational Commit Semantics

Once routing is committed:

- The committed shape is written to Discovery's session log (the journey record)
- Transition into shape-appropriate output:
  - **Epic** → topic synthesis (see [topic-synthesis.md](topic-synthesis.md))
  - **Feature / cross-cutting** → single-topic commit + routing
  - **Bugfix / quickfix** → brief intent capture + routing decision; no map
- Pivots after commit are possible but expensive — they reset the synthesis. Treat post-commit pivots as deliberate redirects, not casual exploration ([pivot-watchpoints.md](pivot-watchpoints.md))
- For epic / feature / cross-cutting, the macro commit doesn't necessarily lock micro routing yet — per-topic routing commits happen during/after synthesis

The macro and micro commits can land at the same conversational moment (single-topic feature: *"feature-shaped, routing is discussion"*) or at different moments (epic: macro commit first, then per-topic routing commits during synthesis).

## G. AskUserTool — When and When Not

Summary of where AskUserTool fits in the Discovery loop:

| Moment | AskUserTool? |
|---|---|
| Mid-loop tentative surfacings | No — stays conversational |
| Explicit shape questions (binary disambiguator) | OK when the disambiguation is genuinely binary and explicit framing helps |
| Routing commit moment (this file) | Yes — structured confirm/override/discuss-more |
| Endpoint / synthesis confirmation | Yes — matches today's pattern |
| Adjustments after synthesis (split / merge / rename / re-route) | Yes — structured slots |

Principle: AskUserTool appears at structured decision moments, not during conversational exploration. The tool's clarity is its value at commit; that same clarity is its cost mid-loop.

→ Return to caller.
