# Harvest Nudge

*Reference for **[workflow-discovery](../SKILL.md)***

---

Loaded from [session-loop.md](session-loop.md) B when the conversation may be converging. Owns the arc model, confirms whether the conversation has actually reached convergence, and — only then — weaves an ambient, non-blocking harvest nudge into the exploration turn. It surfaces an offer; it never ends the turn, renders a menu, or asks a gated question. Synthesis fires only when the user pulls — handled in [session-loop.md](session-loop.md) C, not here.

## The arc

A design conversation moves through three phases:

- **Diverge** — ideas widen, surfaces multiply, the user is still throwing things onto the table. New ground every few turns.
- **Tension** — conflicts and tradeoffs surface; two leanings pull against each other; the hard parts get argued. This is where the sparring earns its keep.
- **Converge** — the tensions resolve into soft landings, the surfaces stop multiplying, the picture stops moving. The decisions **decouple enough to silo** — exactly the condition that makes topics separable.

Convergence is the only moment to surface the nudge. Read it from the proxies in [discovery-guidelines.md](discovery-guidelines.md) C — circling back to covered ground, turns that only confirm, a mapped-feeling picture, flagging energy. The coupling of the problem sets how long this takes: a greenfield epic converges fast (topics are naturally separable); a rebuild stays in tension far longer (the decisions are mutually entangled). Don't rush it — a conversation still in tension is not ready to silo.

## Surfacing the nudge

#### If the conversation is still diverging or in tension

No nudge. Keep exploring — surface the next tension, follow the open thread.

→ Return to caller.

#### If the conversation has converged

Weave the nudge into your normal exploration turn: a one-line read of where things have settled, then an ambient offer to harvest whenever the user's ready. It is **not** a separate block, **not** a menu, and **not** a question that ends the turn — the turn keeps its forward momentum and the offer rides along. Adapt the wording to the conversation; these are illustrative, not a template to render verbatim:

```
Say when you want to pull topics out of this and move forward — for
now, let's keep going.
```

```
Feels like this is settling. Whenever you want to harvest topics from
it, just say — no rush, we can keep pulling on anything still loose.
```

The user may take the offer, ignore it, or keep talking. If they keep talking, stay in the loop and re-read the arc as it moves. Don't repeat the nudge every turn — offer it once at convergence, and again only if the conversation converges afresh after more exploration.

→ Return to caller.
