# Discovery Guidelines

*Reference for **[workflow-discovery](../SKILL.md)***

---

## A. Curatorial Moves

- **Open exploration is the loop.** The session is a conversation that pulls on the idea — sketches the shape, finds the edges, sees how the parts connect, and reasons across the whole. Topics emerge at harvest from the picture as a whole.
- **Macro view always.** Hold the whole epic in view; don't silo into one item and resolve it. Substance is welcome — but at the cross-cutting level, where a decision touches many parts. If the conversation tunnels into a single topic's mechanism, anchor and return to the whole.
- **Surface tensions.** When two leanings pull against each other — event-sourcing vs a simpler store, offline-first vs server-authoritative — name the tension and hold it open. Don't paper over it to keep things smooth.
- **Probe framing.** Question the framing itself, not just its contents. *"You're describing this as one product — is the operator side really the same product as the diner side, or two that share a spine?"*
- **Counter-frame.** Offer an alternative shape when you see one. *"What if the menu isn't the centre — what if orders are, and the menu's just one input?"* — a proposal to react to, not a verdict.
- **Tentative grouping** *during exploration*, not as topic decomposition. *"Sounds like the offline-mode bits all live together — agree?"* — confirming a surface boundary, not naming a topic.
- **Coarseness check** *during exploration*. *"That's a lot of small operational things — most of those will fall out inside bigger discussions later."*
- **Anchor and return.** When the conversation tunnels into one topic's mechanism — the detail its own future discussion will resolve — gently re-anchor to the whole. *"We're deep in payments-mechanism — that's its own discussion later. Want to come back to how it connects to the rest first?"*
- **Read the arc, not the endpoint.** A design conversation moves diverge → tension → converge. Don't propose an ending — read where the conversation is, and let convergence cue the harvest nudge (§C). Synthesis fires only when the user pulls.

→ Load **[topic-granularity.md](../../workflow-shared/references/topic-granularity.md)** and follow its instructions as written. The rules apply at synthesis, not during exploration — but having them in context helps you avoid pre-emptively splitting things you don't yet need to.

→ Load **[routing-inference.md](routing-inference.md)** and follow its instructions as written. Routing is proposed at synthesis based on cues from how each surface was framed.

## B. Open Exploration — How

Discovery explores the **whole** — holistically, across the epic, not by tunneling into one topic. You're reasoning about the shape *and* the substance of the system at once: how the parts connect, where they pull against each other, which direction the whole leans. Per-topic research and discussion fill each part's volume later; here you hold the whole in view and let the substance that's genuinely cross-cutting be in play.

**Where to push:**

- **User flows** — *"what would the user do here?"*, *"who's the user at this point — diner or operator?"*
- **Surfaces and modes** — *"is this the same flow for the diner and the operator?"*, *"does it work the same online and offline?"*
- **Connections** — *"how does this talk to X?"*, *"what kicks off Y?"*, *"where does this slot into the order flow?"*
- **Edges** — *"what happens at the boundary between A and B?"*, *"is there a moment where this gets handed off?"*
- **Hidden surfaces** — gently surface parts the user hasn't mentioned. *"I notice you didn't mention Z — separate thing, or part of W?"*
- **Cross-cutting substance** — the leanings and tensions that touch many parts. *"If you go event-sourced, that reshapes the data model, the state machine, and every journey — is that the direction?"* Engage it; land it **soft** (§D).

**Where to hold soft (don't resolve):**

- **One topic's build detail** — the API shape, the data model of a single surface. That's its specification later. Cross-cutting design direction is in play; one topic's implementation is not.
- **Feasibility to a verdict** — lean on what you and the user already know (*"event-sourcing's heavier on ops — worth it for the audit trail?"*), but don't go validate it. Confirming feasibility is research.
- **A hard decision** — discovery lands decisions **soft** (§D), never as final verdicts. Hardening is the per-topic discussion's job.

**Cadence:** One thread at a time. Wait for the answer. Let it shape where you push next. Don't run a checklist of question types or rapid-fire a battery of questions — follow the conversation. Many turns of this; the picture develops, then topics fall out at harvest.

**Collaborative challenge — sparring, not mirroring:** You're an opinionated partner, not a mirror. Disagree when you see it differently, counter-frame, surface the tension, propose a "what if" — the register is two senior engineers sparring over a whiteboard. Echo the shape back when it genuinely helps the user correct it, but don't *only* reflect. Two failure modes to avoid: **interrogation** — rapid-fire questions that probe reasoning like a research interview; and **lecturing** — a monologue of your own conclusions. Sparring is a live back-and-forth on one thread, each turn reacting to the last.

**Documenting:** At natural pauses (a thread adequately explored, conversation about to branch, accumulating detail), write to the **Exploration** section of the session log as **medium-fidelity narrative** — capture the reasoning-moves (ideas, objections, pivots, soft-landings, dead-ends and rejected paths), not verbatim and not a strong summary. Append-forward; depth accrues by layering down, never by editing earlier entries. The log survives context refresh; in-context memory does not.

## C. Reading Convergence

A design conversation has an arc: **diverge** (ideas widen, surfaces multiply) → **tension** (conflicts and tradeoffs surface) → **converge** (things settle, decisions decouple enough to silo). You never declare an ending — you read which phase the conversation is in, and convergence is the only moment to surface the harvest nudge. See [harvest-nudge.md](harvest-nudge.md) for reading the arc and weaving the nudge.

Proxies that the conversation is **converging**:

- It circles back to surfaces already covered rather than opening new ground.
- Several turns produce only confirmation — the tensions have resolved into soft landings.
- The picture feels mapped: you could name the parts, find their edges, see the connections.
- The user's energy on the thread has flagged (paragraphs get shorter, agreement increases).

These cue the nudge — an ambient, optional offer to harvest. They do **not** license declaring an endpoint or pushing to synthesis. **Synthesis is user-pulled**: it fires only when the user says to pull topics out. In divergence or tension, there's no nudge — keep exploring.

## D. Hard Rules

**Soft-by-location** (the canonical statement; later phases infer it): discovery makes real decisions, but they are **soft** by virtue of *where they live*. Firmness is conferred by position on the gradient — discovery (soft) → discussion (hardened by convergence) → spec (golden) → plan. So explore substance freely and land decisions, but record them in **soft language** (*"leaning event-sourcing because the audit trail's worth the ops cost"*) — never as hard verdicts, and never hedged into uselessness. The per-topic discussion ratifies; that is what lets discovery explore substance without bypassing the convergence rigor that makes a decision trustworthy.

- **No inline topic decomposition.** Don't surface "hearing X, Y, Z as distinct topics" moves during the loop. Topics are synthesised at harvest.
- **The user pulls synthesis.** You read convergence and can offer the nudge, but the user decides when to harvest. Don't move to synthesis without an explicit pull.
- **Initial spike, not exhaustive.** 2 topics is fine, 20 is fine. The map fills out as work progresses — analyses auto-add, splits and reroutes spawn. Don't push for completeness at harvest.
- **Decisions land soft, not hard.** Lean, and record the lean; don't ratify. A soft decision invites the discussion to re-open it intelligently — a hard verdict pre-empts the convergence that makes it trustworthy.
- **Substance, not validation.** Reason from what you and the user already know; don't go investigate. Feasibility validation is research; symptom and root-cause hunting is investigation.
- **Topics named at surface level.** Design tensions and architecture direction are in play as soft substance, but topics are still named at the level a future research or discussion picks up — *kitchen-printers*, *menu-management*, *analytics* — not API shapes or data models.

## E. Worked Examples

Reference dialogues showing how each curatorial move plays out. Read these as context for your own moves — they are **not** output templates to render verbatim to the user.

**Open exploration**

```
User: "I want to build a restaurant ordering platform. Menus, orders,
       kitchen printers, some analytics."

Claude: "Who's the operator side — a single restaurant, or a chain
        operator running multiple venues?"

User: [answers]

Claude: "Got it. When you say 'analytics', is that for the venue
        owner watching their own place, or for the platform operator
        looking across all venues?"

User: [answers]

Claude: "And the diner — do they interact with the system directly,
        like scanning a QR at the table, or is it the waiter
        punching the order in?"
```

Many turns of this. One thread per turn — wait for the answer, let it shape the next. These are feeling for where the surfaces are and how they connect.

**Sparring — challenge, tension, soft landing**

```
User: "I think every order just writes its current state to the DB —
       one row per order, updated in place. Simple."

Claude: "Simplest, agreed — but you've also said you need a full audit
        trail for disputes, and the kitchen wants to replay what
        happened when a printer jammed. Update-in-place throws that
        history away. Worth sitting with the tension: simple store vs
        replayable history."

User: "Hadn't connected those. The replay matters more than I said."

Claude: "Then I'd lean event-sourced for orders — append each change,
        derive current state — because the audit trail and the replay
        both fall out of it for free. Heavier on ops, and it's a soft
        lean, not settled — the orders discussion will pressure-test
        it. But that's the direction I'd point."
```

Claude disagrees, names the tension, holds it open, then lands a **soft** decision in soft language (*"I'd lean… soft lean, not settled… the discussion will pressure-test it"*). Not interrogation (no rapid-fire), not lecturing (it reacts to the user, one thread).

**Tentative grouping** (during exploration, surface-level)

```
User: "Then there's offline-mode, and also some way to handle
       network-flakiness — like what happens mid-order if the
       connection drops."

Claude: "Both about keeping the app usable when the network's bad —
        I'd put them under the same surface. Any other cases where
        you're picturing offline behaviour, or does that pair cover
        it?"
```

This isn't naming a topic. It's mirroring the shape back so the user can confirm or correct the surface boundary.

**Coarseness check**

```
User: "Oh, and we'll need to log errors. And rate-limit the
       API. And add health checks. And…"

Claude: "Stack of small operational items — most of those will
        fall out naturally inside bigger discussions (deployment,
        API-shape). Want me to leave them off and we add them
        later if they don't get covered?"
```

**Anchor and return**

```
User: "For payments — Stripe charges 2.9% + 30c, but Adyen is
       cheaper for European cards if you have over £X volume,
       and there's also bank-direct..."

Claude: "We're a few clicks deep into payments-mechanism — that's
        its own discussion once we're there. Want to come back to
        mapping the rest first, and pick that up properly inside it?"
```

One topic's fee comparison is its discussion's job — anchor back to the whole. Cross-cutting substance (how payments couples to the order lifecycle) would stay in play.

**Convergence and the harvest nudge**

```
[Fifteen turns in. The data-model tension landed soft, the surfaces
are named, and the last few turns only confirm shapes already
covered — the conversation is converging.]

Claude: "...so the operator dashboard reads the same order projection
        the kitchen does — that closes the loop on how those two
        connect. The picture's settling now: diner ordering, menu
        management, kitchen output, operator analytics, and the
        offline surface, with orders leaning event-sourced. Say when
        you want to pull topics out of this and move forward — no
        rush, we can keep pulling on anything still loose."
```

The nudge is woven into a normal turn that still moves the exploration forward. It's an ambient offer — no menu, no "ready? (y/n)", no stop. The user takes it or keeps going.

→ Return to caller.
