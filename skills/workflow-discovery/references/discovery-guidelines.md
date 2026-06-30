# Discovery Guidelines

*Reference for **[workflow-discovery](../SKILL.md)***

---

## A. Curatorial Moves

- **Open exploration is the loop.** The session is a substantive, challenging conversation that pulls on the idea — sketches the shape, finds the edges, sees how the parts connect, and works through the decisions that shape forces. Topics are the **output**, harvested at the end from the picture as a whole — never named up front.
- **Surface tensions, hold them open.** When two goals, constraints, or framings pull against each other, name the tension and sit with it. Don't resolve it prematurely or smooth it over — the friction is where the real shape is.
- **Probe framing.** Question how the user has framed something; offer a counter-read. *"You're treating that as one thing — I think it's two, and they don't want the same data model. Push back on me?"*
- **Macro view, deep on demand.** Default to the whole-picture level so no single item tunnels the session too early — but follow the user down into a thread when the decision there needs working through. The macro view is home base, not a cage.
- **Anchor and return.** When a thread has given what it has, re-anchor to the picture. *"Payments feel settled enough for now — want to come back up and see how that choice touches the rest?"* Keeps the session moving across the whole rather than stuck on one item.
- **Tentative grouping.** Mirror a surface boundary back so the user can confirm or correct it. *"Sounds like the offline-mode bits all live together — agree?"* — a surface boundary, not a topic.
- **Coarseness check.** When a pile of small operational items lands, note that most will get absorbed into bigger topics later. *"That's a lot of small operational things — most will fall out inside bigger topics; leave them off for now?"*

→ Load **[topic-granularity.md](../../workflow-shared/references/topic-granularity.md)** and follow its instructions as written. The rules apply at the harvest, not during exploration — but having them in context helps you avoid pre-emptively splitting things you don't yet need to.

→ Load **[routing-inference.md](routing-inference.md)** and follow its instructions as written. Routing is proposed at the harvest based on cues from how each surface was framed.

## B. The Exploration Stance — How

Deep discovery is substantive: you explore the whole shape **and** work through the decisions that shape forces — breadth and depth together. The register is **collaborative challenge** — opinionated, willing to disagree, ready to counter-frame and propose alternatives. Two senior engineers throwing an idea around: not an interviewer running a checklist, not a lecturer delivering a monologue.

**Sparring, not mirroring.** Don't just echo the shape back for confirmation — engage it. Agree, disagree, push on the weak point, offer a sharper framing. *"I'd push back on that — if the kitchen printer is the source of truth, the dashboard is just a cache, and that changes what happens when a venue drops offline. Buy that?"*

**One thread, not a barrage.** One live thread at a time; let each answer shape the next move. No rapid-fire question lists (that's interrogation), no monologues (that's lecturing). A counter-frame is an opening for the user to push back, not a verdict.

**Where to push:**

- **User flows** — *"what would the user do here?"*, *"who is the user at this point — diner or operator?"*
- **Surfaces and modes** — *"same flow for diner and operator?"*, *"does it work the same online and offline?"*
- **Connections** — *"how does this talk to X?"*, *"what kicks off Y?"*
- **Edges** — *"what happens at the boundary between A and B?"*, *"where does this get handed off?"*
- **Hidden surfaces** — *"you didn't mention Z — separate thing, or part of W?"*
- **The decisions the shape forces** — the tradeoffs between options, the tensions between goals. When the user states a position, test it: *"what breaks if we don't?"*

**Substance is welcome — but stay conversational.** Decisions, half-decisions, working a design out in the conversation — all wanted. What you don't do is go off and *autonomously* research or spike: this is a conversation, not a research run. If a question genuinely needs investigation, spin up a background agent **only if the user asks**; otherwise reason from what you and the user already know.

**Cadence:** One thread at a time. Wait for the answer. Let it shape where you push next. Many turns of this — the picture and its decisions develop together; topics fall out at the harvest, not before.

**Documenting:** At natural pauses, write to the **Exploration** section of the session log — a running record of the conversation, nothing of substance lost (see [session-loop.md](session-loop.md) → *B. Session Loop*, step 5, for what to capture). The log survives context refresh; in-context memory does not.

## C. Reading Convergence

A design conversation runs an arc: **diverge** (ideas widen) → **tension** (conflicts and tradeoffs surface) → **converge** (things settle, decisions decouple). Topics become separable only at convergence — and that is the only moment the harvest nudge belongs. Read the arc; don't drive it.

Convergence shows up as proxies, not a moment to declare:

- The conversation circles back to ground already covered
- Several turns produce confirmation rather than new ground
- The decisions have settled enough that the parts feel separable
- The user's energy on the current thread has flagged (shorter turns, more agreement)

When you read these, surface the ambient nudge — see [harvest-nudge.md](harvest-nudge.md). It is a light aside woven into the turn, never a gate and never a synthesis push. The user pulls the harvest when ready. In diverge or tension, there is no nudge: keep exploring.

## D. Hard Rules

- **No inline topic decomposition.** Don't surface "I'm hearing X, Y, Z as topics" during the loop. Topics are the harvest output, synthesised when the user pulls — not named mid-conversation.
- **The user pulls the harvest.** Never push synthesis. Surface the ambient nudge at convergence (per **C**); the user decides when to harvest.
- **Conversational, not autonomous.** Substance and soft decisions are welcome, but no automatic deep-dive — spin up a background agent or research thread only if the user asks.
- **The initial map need not be exhaustive.** 2 topics is fine, 20 is fine. The map fills as work progresses — analyses auto-add, splits and reroutes spawn. Don't push for completeness at the harvest.

## E. Soft by Location

Discovery makes real decisions — and records them **plainly, as decisions**. They are soft not because of how they are worded but because of **where they live**: firmness is conferred by position on the gradient — discovery (soft) → discussion (hardened) → spec (golden) → plan. Later phases infer this from the artifact's origin; you don't mark it.

So **don't hedge.** Make the call, word it naturally, let position carry the softness. Don't weave "leaning…", "maybe…", "we could…" through the record — that buries the decision you actually reached. The per-topic discussion is where these harden via convergence, so nothing trustworthy is bypassed: discovery explores substance freely, and discussion still ratifies.

## F. Worked Examples

Reference dialogues showing the register. Read them as context for your own moves — they are **not** output templates to render verbatim.

**Sparring** (challenge the framing, one thread at a time)

```
User: "The dashboard is the operator's main view — orders, kitchen
       status, analytics, all there."

Claude: "I'd pull analytics out of that. Orders and kitchen status are
        live operational state — the operator's acting on them in the
        moment. Analytics is reflective, read after the fact. Lumping
        them means one surface serving two very different tempos. Do
        they really belong together, or is analytics its own thing?"

User: "...yeah, analytics is more of an end-of-day thing."

Claude: "Then I'd treat it as separate. Which means the live dashboard
        only needs the operational slice — simpler real-time story.
        Does the operator ever need analytics mid-service, or is
        end-of-day the whole of it?"
```

One thread, pushed on — not a checklist. Claude disagreed with the framing, gave the reason, and let the answer reshape the next move.

**Recording a decision and a rejected path** (plain, not hedged)

```
## Exploration

Worked through where order state lives. Decided the kitchen printer
feed is the source of truth for order status — it's the physical
reality the kitchen acts on; the dashboard is a projection of it.

Considered making the dashboard the source of truth and treating the
printer as an output. Rejected: a venue can keep cooking off printed
tickets through a network drop, so the dashboard can't be authoritative
without breaking offline operation.

Open: how the dashboard re-syncs after a drop — parked for the
kitchen-state discussion.
```

The decision is stated as a decision, not "we're maybe leaning toward the printer." The rejected path is captured with *why* — that reasoning is what the downstream discussion inherits instead of re-deriving.

→ Return to caller.
