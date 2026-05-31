# Discovery Guidelines

*Reference for **[workflow-discovery](../SKILL.md)***

---

## A. Curatorial Moves

- **Open exploration is the loop.** The session is a conversation that pulls on the idea — sketches the shape, finds the edges, sees how the parts connect. Topics emerge at endpoint from the picture as a whole.
- **Macro view always.** Don't tunnel into one item. If the user goes deep on mechanism, gently anchor and return to the map level.
- **Tentative grouping** *during exploration*, not as topic decomposition. *"Sounds like the offline-mode bits all live together — agree?"* — confirming a surface boundary, not naming a topic.
- **Coarseness check** *during exploration*. *"That's a lot of small operational things — most of those will fall out inside bigger discussions later."*
- **Anchor and return.** When the conversation pulls into detail, gently re-anchor. *"We got pulled into payments mechanism — that's discussion territory once we're there. Want to come back to mapping the rest first?"*
- **Endpoint observation.** Notice when the conversation circles back to surfaces already covered, when several turns produce only confirmation rather than new ground, when the picture feels mapped. Propose endpoint to the user — don't declare it. The user confirms or extends.

→ Load **[topic-granularity.md](../../workflow-shared/references/topic-granularity.md)** and follow its instructions as written. The rules apply at synthesis, not during exploration — but having them in context helps you avoid pre-emptively splitting things you don't yet need to.

→ Load **[routing-inference.md](routing-inference.md)** and follow its instructions as written. Routing is proposed at synthesis based on cues from how each surface was framed.

## B. Open Exploration — How

Discovery explores **breadth**, not depth. You're sketching the outline of a 3D shape; research and discussion fill the volume. The questioning style differs from research's interview probing — you're surfacing the shape, not interrogating reasoning behind it.

**Where to push:**

- **User flows** — *"what would the user do here?"*, *"what's their next step?"*, *"who's the user at this point — diner or operator?"*
- **Surfaces and modes** — *"is this same flow for the diner and the operator?"*, *"does it work the same online and offline?"*, *"does this exist on mobile only or also on the till?"*
- **Connections** — *"how does this talk to X?"*, *"what kicks off Y?"*, *"where does this slot into the order flow?"*
- **Edges** — *"what happens at the boundary between A and B?"*, *"what's the case where this doesn't apply?"*, *"is there a moment where this gets handed off?"*
- **Hidden surfaces** — gently surface parts the user hasn't mentioned. *"I notice you didn't mention Z — is that a separate thing or part of W?"*

**Where NOT to push:**

- **How something would be built** — architecture, data model, tech choices. That's specification later.
- **Why one approach is better than another** — that's discussion.
- **Whether something is feasible or competitive** — that's research.
- **Reasons behind a position** — research-style "why do you think that?" probes go deeper than discovery needs. If the user says the printer should be wireless, you don't need to know why; you need to know whether wireless-vs-wired is a distinct surface to map.

**Cadence:** One question at a time. Wait for the answer. Let the answer shape where you push next. Don't run a checklist of question types — follow the conversation. Many turns of this **before** endpoint — the picture develops, then topics fall out at synthesis.

**Mirroring, not challenging:** Echo the emerging shape back so the user can correct it. *"So I'm picturing — the diner scans a QR, orders, the kitchen printer fires, the operator sees it in the dashboard. Am I drawing that right?"* Don't challenge assumptions during exploration — that posture belongs in research and discussion.

**Documenting:** At natural pauses (a surface adequately explored, conversation about to branch, accumulating detail), write a strong-summary entry to the **Exploration** section of the session log. Prose, not transcript. Capture what was named and what crystallised. The log survives context refresh; in-context memory does not.

## C. Endpoint Detection

The user can signal endpoint explicitly (*"that covers it"*, *"let's wrap"*, *"done"*). You can also observe natural endpoint patterns and propose. Watch for:

- The conversation circles back to surfaces already covered
- Several turns produce only confirmation of existing surfaces — no new ground
- The shape feels mapped — you could name the parts, find their edges, see the connections
- The user's energy on the topic has flagged (paragraphs get shorter, agreement increases)

When you observe these signals, **propose** endpoint to the user. Don't declare it. Use optional pushback if there's a genuinely unexplored angle worth surfacing first — but don't fabricate angles. If nothing comes to mind, just ask whether to proceed.

## D. Hard Rules

- **No inline topic decomposition.** Do not surface "hearing X, Y, Z as distinct shapes" moves during the loop. Topics are synthesised at endpoint.
- **The user confirms endpoint.** You can propose, but the user decides. Don't move to synthesis without explicit confirmation.
- **Initial spike, not exhaustive.** 2 topics is fine, 20 is fine. The map fills out as work progresses — analyses auto-add, splits and elevations spawn. Don't push for completeness at synthesis.
- **No active missing-piece probes during exploration.** Don't list things the user "hasn't mentioned" as if you're auditing coverage. If something comes to mind during exploration, raise it as a natural question. At endpoint, optional pushback can surface one or two angles — bounded, not exhaustive.
- **No decisions, no investigations.** Defer mechanism questions to discussion; defer feasibility to research. Use what you and the user already know; don't go searching.
- **No code, no architecture, no implementation talk.** Topics are named at the level a future research or discussion phase would pick up — *kitchen-printers*, *menu-management*, *analytics* — not API shapes or data models.

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

Several turns of this before endpoint is proposed. One question per turn — wait for the answer, let it shape the next question. The questions don't push into *how* the printer works or *why* you'd pick one approach — they're feeling for where the surfaces are and where they connect.

**Tentative grouping** (during exploration, surface-level)

```
User: "Then there's offline-mode, and also some way to handle
       network-flakiness — like what happens mid-order if the
       connection drops."

Claude: "Both about keeping the app usable when the network's bad —
        I'd put them under the same surface. Are there any other
        cases where you're picturing offline behaviour, or does
        that pair cover it?"
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

Claude: "We're a few clicks deep into payments-mechanism — that
        sounds like discussion territory once we're there. Want
        to come back to mapping the rest first, and we pick that
        up properly there?"
```

**Endpoint observation and proposal**

```
[Twelve turns in. Last three turns have been the user confirming
shapes already covered. No new surfaces named.]

Claude: "Feels like we've sketched the shape — diner ordering, menu
        management, kitchen output, operator analytics, and the
        offline-mode surface. We didn't talk about how returns or
        refunds work — worth a moment, or out of scope for now?"

User: "Out of scope."

Claude: "OK. Anything else you want to pull on before I synthesise
        topics, or shall I go?"
```

→ Return to caller.
