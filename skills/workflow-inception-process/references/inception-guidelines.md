# Inception Guidelines

*Reference for **[workflow-inception-process](../SKILL.md)***

---

## A. Curatorial Moves

- **Open exploration first.** Feel out the shape of the product with the user — surface its parts, find its edges, see where it connects to itself. Don't go deep enough to investigate feasibility, weigh tradeoffs, or pick approaches. You're outlining the shape; research and discussion fill the interior. **Reflective decomposition comes after the picture has shape, not on the first turn.**
- **Macro view always.** Don't tunnel into one item. If the user goes deep on mechanism, gently anchor and return to the map level.
- **Reflective decomposition.** Once enough shape has emerged from exploration, read back what you're hearing as distinct surfaces; suggest tentative groupings. *"Hearing X, Y, Z as distinct shapes — agree?"*
- **Tentative grouping.** *"Those two feel like one thing — agree?"*
- **Coarseness check.** Surface when items pile up, but don't push exhaustiveness. *"We've got 15; some feel small enough they'll fall out of bigger discussions."*
- **Anchor and return.** When the conversation pulls into detail, gently re-anchor. *"We got pulled into payments detail; want to come back to mapping the rest first?"*
- **Routing inference.** Read the user's framing for cues; tentatively propose; let them flip.

→ Load **[topic-granularity.md](../../workflow-shared/references/topic-granularity.md)** and follow its instructions as written. Apply the independence test and anti-patterns to any decomposition you propose — prefer broader topics that share a domain or decision space; resist splitting one product surface into its implementation concerns.

→ Load **[routing-inference.md](routing-inference.md)** and follow its instructions as written.

## B. Open Exploration — How

Inception explores **breadth**, not depth. You're sketching the outline of a 3D shape; research and discussion fill the volume. The questioning style differs from research's interview probing — you're surfacing the shape, not interrogating reasoning behind it.

### Where to push

- **User flows** — *"what would the user do here?"*, *"what's their next step?"*, *"who's the user at this point — diner or operator?"*
- **Surfaces and modes** — *"is this same flow for the diner and the operator?"*, *"does it work the same online and offline?"*, *"does this exist on mobile only or also on the till?"*
- **Connections** — *"how does this talk to X?"*, *"what kicks off Y?"*, *"where does this slot into the order flow?"*
- **Edges** — *"what happens at the boundary between A and B?"*, *"what's the case where this doesn't apply?"*, *"is there a moment where this gets handed off?"*
- **Hidden surfaces** — gently surface parts the user hasn't mentioned. *"I notice you didn't mention Z — is that a separate thing or part of W?"*

### Where NOT to push

- **How something would be built** — architecture, data model, tech choices. That's specification later.
- **Why one approach is better than another** — that's discussion.
- **Whether something is feasible or competitive** — that's research.
- **Reasons behind a position** — research-style "why do you think that?" probes go deeper than inception needs. If the user says the printer should be wireless, you don't need to know why; you need to know whether wireless-vs-wired is a distinct surface to map.

### Cadence

One question at a time. Wait for the answer. Let the answer shape where you push next. Don't run a checklist of question types — follow the conversation. Several turns of this **before** any topic surfacing — the picture develops, then topics fall out naturally.

### Watch for the shape clicking

You'll feel it: the user's answers stop introducing genuinely new surfaces and start filling detail into ones already mentioned. That's the cue to move to reflective decomposition — not before.

### Mirroring, not challenging

Echo the emerging shape back so the user can correct it. *"So I'm picturing — the diner scans a QR, orders, the kitchen printer fires, the operator sees it in the dashboard. Am I drawing that right?"* This is collaborative outlining, not adversarial interview. Save the *"challenge assumptions"* posture for research and discussion — both have decisions and feasibility on the table; inception doesn't.

## C. Hard Rules

- **Exploration before decomposition.** Do not surface topics as candidates in your first turn after the user's opening description. Ask exploratory questions first. The picture develops, then the topics fall out.
- **The user decides convergence.** Do not infer convergence from silence, from having already named topics, or from the user re-framing existing items. The user signals when they have enough.
- **Initial spike, not exhaustive.** 2 topics is fine, 20 is fine. The map fills out as work progresses — analyses auto-add, splits and elevations spawn. Don't push for completeness; the user signals when they have enough to start.
- **No active missing-piece probes.** Don't list things the user "hasn't mentioned." If they go quiet, a soft *"anything else come to mind, or are we good?"* is enough.
- **No decisions, no investigations.** Defer mechanism questions to discussion. Use what you and the user already know; don't go searching.
- **No code, no architecture, no implementation talk.** Topics are named at the level a future research or discussion phase would pick up — *kitchen-printers*, *menu-management*, *analytics* — not API shapes or data models.

## D. Worked Examples per Move

**Open exploration**

```
User: "I want to build a restaurant ordering platform. Menus, orders,
       kitchen printers, some analytics."

Claude: "Before we name topics — who's the user on the operator side?
        Single-location restaurants or chains? And when you say
        'analytics', are you picturing it for the venue owner watching
        their own place, or for the platform operator watching all
        venues across the network?"

User: [answers]

Claude: "Got it. What about the diner — do they interact with the
        system directly (scan a QR at the table, that kind of thing)
        or is it mostly the waiter punching the order in?"

User: [answers]

Claude: "Interesting. Picturing the printer piece — is there one
        printer per kitchen, or per station? And does the same flow
        cover dine-in and takeaway, or do those split somewhere?"
```

Several turns of this before any topic surfacing. Sketching the outline. The questions don't push into *how* the printer works or *why* you'd pick one model — they're feeling for where the surfaces are and where they connect.

**Reflective decomposition** (after exploration has shaped the picture)

```
[Several turns into the conversation, the user has described the
diner flow, operator dashboard, kitchen output, and the analytics
distinction.]

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
