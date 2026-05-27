# Inception Guidelines

*Reference for **[workflow-inception-process](../SKILL.md)***

---

## A. Curatorial Moves

- **Open exploration first.** Pull on the idea before naming topics. Sketch the picture with the user — ask how things would work, what the user's experience looks like, what edges or integrations come into play. Push back gently when something feels under-specified. Don't go deep enough to research feasibility or decide an approach — just shape the picture. **Reflective decomposition comes after the picture has shape, not on the first turn.**
- **Macro view always.** Don't tunnel into one item. If the user goes deep on mechanism, gently anchor and return to the map level.
- **Reflective decomposition.** Once enough shape has emerged from exploration, read back what you're hearing as distinct surfaces; suggest tentative groupings. *"Hearing X, Y, Z as distinct shapes — agree?"*
- **Tentative grouping.** *"Those two feel like one thing — agree?"*
- **Coarseness check.** Surface when items pile up, but don't push exhaustiveness. *"We've got 15; some feel small enough they'll fall out of bigger discussions."*
- **Anchor and return.** When the conversation pulls into detail, gently re-anchor. *"We got pulled into payments detail; want to come back to mapping the rest first?"*
- **Routing inference.** Read the user's framing for cues; tentatively propose; let them flip.

→ Load **[exploratory-questioning.md](../../workflow-shared/references/exploratory-questioning.md)** and follow its instructions as written. The *how* of asking lives there; the *what to ask about* (shape of the product, not feasibility or decisions) is inception-specific.

→ Load **[topic-granularity.md](../../workflow-shared/references/topic-granularity.md)** and follow its instructions as written. Apply the independence test and anti-patterns to any decomposition you propose — prefer broader topics that share a domain or decision space; resist splitting one product surface into its implementation concerns.

→ Load **[routing-inference.md](routing-inference.md)** and follow its instructions as written.

## B. Hard Rules

- **Exploration before decomposition.** Do not surface topics as candidates in your first turn after the user's opening description. Ask exploratory questions first. The picture develops, then the topics fall out.
- **The user decides convergence.** Do not infer convergence from silence, from having already named topics, or from the user re-framing existing items. The user signals when they have enough.
- **Initial spike, not exhaustive.** 2 topics is fine, 20 is fine. The map fills out as work progresses — analyses auto-add, splits and elevations spawn. Don't push for completeness; the user signals when they have enough to start.
- **No active missing-piece probes.** Don't list things the user "hasn't mentioned." If they go quiet, a soft *"anything else come to mind, or are we good?"* is enough.
- **No decisions, no investigations.** Defer mechanism questions to discussion. Use what you and the user already know; don't go searching.
- **No code, no architecture, no implementation talk.** Topics are named at the level a future research or discussion phase would pick up — *kitchen-printers*, *menu-management*, *analytics* — not API shapes or data models.

## C. Worked Examples per Move

**Open exploration**

```
User: "I want to build a restaurant ordering platform. Menus, orders,
       kitchen printers, some analytics."

Claude: "Before we name topics — tell me more about the operator side.
        Are these single-location restaurants or chains? And when you
        say 'analytics', are you picturing it for the restaurant owner
        watching their own venue, or for the platform operator watching
        all venues across the network?"

User: [answers]

Claude: "Got it. What about the diner side — do they interact with the
        system directly (e.g., scan a QR code at the table) or is it
        mostly the waiter punching in orders?"

User: [answers]

Claude: "Interesting. Let's pull on the printer piece — what happens
        when the kitchen printer's offline mid-service?"
```

Several turns of this before any topic surfacing. The picture develops; topics fall out naturally once the shape is in view.

**Reflective decomposition** (after exploration has shaped the picture)

```
[A few turns into the conversation, the user has described menus,
order flow, kitchen output, and operator-vs-venue analytics distinct.]

Claude: "Hearing four shapes — menu-management, order-intake,
        kitchen-printers, and operator-analytics. Each feels
        distinct enough to be its own topic. Agree, or are
        any of those really one thing?"
```

**Tentative grouping**

```
User: "Then there's offline-mode, and also some way to handle
       network-flakiness — like what happens mid-order if the
       connection drops."

Claude: "Those two feel like one topic to me — both about
        keeping the app usable when the network's bad. I'd
        merge them into 'offline-mode' and we cover both inside
        that discussion. OK?"
```

**Coarseness check**

```
User: "Oh, and we'll need to log errors. And rate-limit the
       API. And add health checks. And…"

Claude: "We've got a stack of small operational items — most
        of those will fall out naturally inside bigger
        discussions (a deployment topic, an API-shape topic).
        Want me to leave them off the map for now and we add
        them later if they don't get covered?"
```

**Anchor and return**

```
User: "For payments — Stripe charges 2.9% + 30c, but Adyen is
       cheaper for European cards if you have over £X volume,
       and there's also bank-direct..."

Claude: "We're a few clicks deep into payments-mechanism — that
        sounds like discussion territory once we're in it. Want
        to come back to mapping the rest first, and we pick that
        up properly there?"
```

→ Return to caller.
