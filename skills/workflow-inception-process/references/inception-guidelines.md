# Inception Guidelines

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Inception is conversational like research and discussion, but operates in a **curatorial mode** distinct from both. The job is naming and shaping topics, not investigating or deciding. These guidelines load once at session start and remain active for the rest of the session.

## A. Curatorial Moves

These are the moves that shape inception. Use them; lean on them when the conversation drifts.

- **Macro view always.** Don't tunnel into one item. If the user goes deep, gently anchor and return to the map level.
- **Reflective decomposition.** Read back what you're hearing as distinct surfaces; suggest tentative groupings. *"Hearing X, Y, Z as distinct shapes — agree?"*
- **Tentative grouping.** *"Those two feel like one thing — agree?"*
- **Coarseness check.** Surface when items pile up, but don't push exhaustiveness. *"We've got 15; some feel small enough they'll fall out of bigger discussions."*
- **Anchor and return.** When the conversation pulls into detail, gently re-anchor. *"We got pulled into payments detail; want to come back to mapping the rest first?"*
- **Routing inference.** Read the user's framing for cues; tentatively propose; let them flip. See **[routing-inference.md](routing-inference.md)** — load it now.

→ Load **[routing-inference.md](routing-inference.md)** and follow its instructions as written.

## B. Hard Rules

These rules override default conversational instincts. They exist because inception's value is *opening framing*, not coverage.

- **Initial spike, not exhaustive.** This is opening framing, not a complete inventory. 2 topics is fine, 20 is fine. The map fills out as work progresses — analyses auto-add, splits and elevations spawn. Don't push for completeness; the user signals when they have enough to start.
- **No active missing-piece probes.** Don't list things the user "hasn't mentioned." If they go quiet, a soft *"anything else come to mind, or are we good?"* is enough.
- **No decisions, no investigations.** Defer mechanism questions to discussion. Use what you and the user already know; don't go searching.
- **No code, no architecture, no implementation talk.** Topics are named at the level a future research or discussion phase would pick up — *kitchen-printers*, *menu-management*, *analytics* — not API shapes or data models.

## C. Worked Examples per Move

### Reflective decomposition

```
User: "We need a way for restaurants to manage their menus,
       see orders coming in, and get printer output to the
       kitchen. Plus some kind of analytics for the operator."

Claude: "Hearing four shapes — menu-management, order-intake,
        kitchen-printers, and operator-analytics. Each feels
        distinct enough to be its own topic. Agree, or are
        any of those really one thing?"
```

### Tentative grouping

```
User: "Then there's offline-mode, and also some way to handle
       network-flakiness — like what happens mid-order if the
       connection drops."

Claude: "Those two feel like one topic to me — both about
        keeping the app usable when the network's bad. I'd
        merge them into 'offline-mode' and we cover both inside
        that discussion. OK?"
```

### Coarseness check

```
User: "Oh, and we'll need to log errors. And rate-limit the
       API. And add health checks. And…"

Claude: "We've got a stack of small operational items — most
        of those will fall out naturally inside bigger
        discussions (a deployment topic, an API-shape topic).
        Want me to leave them off the map for now and we add
        them later if they don't get covered?"
```

### Anchor and return

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
