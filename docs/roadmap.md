# The product roadmap

Some conversations are not about a piece of work at all. A brand-new product being conceived, a "what should the next few months look like", a v2 taking shape in your head — there is no single deliverable on the table, and forcing one into existence too early just manufactures a container you will fight later. The roadmap is where those conversations live: a product layer above the work units, holding everything you have shaped but not yet committed to build.

It has two parts. **Items** are capabilities at the grain you would move around a real roadmap — "loyalty", "white-label" — each with a one-line summary and a pointer back to the conversation that produced it. **Horizons** are the buckets they sit in, named in your own words — MVP, v1, someday, whatever staging language you actually use — and their order is the meaning: first is next up. Nothing here has phases, topics, or plans. An item is a shaped intention, deliberately cheap, so being wrong about one costs nothing.

## How it comes into being

There is no setup ceremony. The roadmap is born the first time something lands on it, and that happens two ways.

The deliberate way: you start a conversation from `/workflow-start` and it turns out to be about the product rather than a nameable piece of work. Discovery recognises that read, confirms it with you, and the conversation simply continues at product altitude — nothing is lost, and no work unit is created. You talk; the system listens for the staging language you use ("for launch we just need…", "once we have revenue…"); and when you say *lay it out*, it proposes the items and horizons it heard, you adjust, and the sorted map persists. The whole session is recorded, so every item carries a pointer into the actual thinking that shaped it.

The incidental way: mid-way through some other conversation — shaping a feature, deep in an epic's discovery, arguing a discussion — a capability surfaces and you place it on the timeline yourself: *"that's a v2 thing."* That is a **park**: one confirmed line and it is on the roadmap, in the horizon you named, and the conversation moves on. The stated placement is what distinguishes a park from an [inbox capture](capture-and-inbox.md) — an unplaced "we should do X sometime" stays an inbox note, because a wrong horizon reads like a decision someone made.

## The pull

Waiting items cost nothing and commit you to nothing. The moment of commitment is the **pull**: you pick the items going into delivery — one, several, a whole horizon — and a work unit is born already fenced to exactly that slice. Several items usually become an epic and the conversation flows straight into its discovery, arriving warm: the new epic's first session is backfilled with the pulled items' share of the product record, so nothing you said has to be said again. A single coherent item can become a feature instead.

The fence matters in both directions. Only the pulled items' ground crosses into the new work unit — the rest of the product record stays where it is, reachable by search, so an epic never silently inherits the whole product. And the pull takes whole items only: wanting half an item means it was really two items, so you split it on the map first. Whatever you did not pull is named and stays visibly waiting — a partial pull is never silent.

## After the pull

Authority splits at that moment. Waiting items remain yours to edit freely — move, rename, merge horizons, re-order, remove. A pulled item becomes a window onto its work unit: you can watch it, but re-bucketing or deleting it is refused, because redirecting in-flight work is the work unit's decision, not the map's. If a later product session genuinely deepens a pulled item's ground, the system flags the join so the epic re-examines it — a signal, never an edit. And if the work unit (or the item's topic within it) is cancelled, the item simply returns to waiting with its history intact: cancelling delivery un-commits the item, it does not erase the thinking.

Lifecycle on the map is never stored, only observed: an item reads as waiting, in flight, or shipped by looking at what became of the work unit it joined. The roadmap cannot disagree with reality, because it has no opinion of its own.

## Living with it

Once the roadmap exists, `/workflow-start` shows it — each horizon with its counts — and an `r/roadmap` row takes you in: browse, open a product session to talk and groom, or pull the next slice. Sessions resume mid-thought if you left one open. Grooming is conversational: promote an inbox idea onto the map, fold a new thought into an existing item, re-sort as your sense of the order changes. When work is being shaped that matches a waiting item, discovery recognises it and offers the pull instead of letting a twin be created beside it — the record comes along instead of being stranded.

The product record itself — the session logs behind the items — is indexed in the [knowledge base](knowledge-base.md), so later work can reach back to the reasoning even years on. What the roadmap deliberately never does is get ahead of itself: no briefs, no topic shaping, no mechanism talk at product altitude. Those belong to the work units a pull creates, at the moment they are actually needed.
