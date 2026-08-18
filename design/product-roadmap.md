# Product roadmap — the product layer above the work unit

A greenfield product conversation today has nowhere truthful to live:
it either happens outside the system (a Claude-app chat whose record
never lands) or inside the first epic, which then inherits everything
that was said — MVP, v1, someday, the crazy ideas — with no cheap way
to say "not now". The roadmap is the project-level layer that fixes
both: a home for product-altitude conversation, a horizon-sorted map
of shaped-but-not-committed work, and a pull mechanism that births
work units already fenced. Design log for the stack. Opened
2026-08-15 from the discussion with Lee.

## Motivation (2026-08-15)

- **The observed workflow leaks.** Lee's actual process for a new
  idea: chat in the Claude app until the idea holds together, dump
  the knowledge to a markdown file, seed discovery with it. The
  richest conversation the product will ever get happens outside the
  system, and only a summary crosses back in.

- **Everything feeds the first epic, so "no" is expensive.** A
  greenfield discovery session surfaces MVP ideas, v1 ideas, v2
  ideas, and ideas that should never be over-thought — and all of it
  lands as topics on one epic's map. There is no staged home, so
  deferring means dismissing (a name-only hard delete that means
  "no", not "later") or archiving to the inbox (raw capture,
  deliberately unshaped). Once shaped things are on the epic map, it
  is very hard not to build them.

- **The genesis record is trapped at the wrong level.** Discovery
  session logs live in `.workflows/{work_unit}/`. The whole-product
  conversation that produced the roadmap-shaped thinking is banked
  inside whichever epic happened to be created first. Return visits
  ("MVP shipped, ready for v1") require remembering what was
  deferred, because nothing above the work unit records it.

- **The epic ceiling was chosen by absorption, never by rejecting a
  layer above.** The original inception design (2026-05-04)
  explicitly recognised the whole-product case — "the user lists
  items at whatever scope makes sense (whole product for
  greenfield)"; "could be hours for a sprawling greenfield product" —
  and handled it by letting one epic's discovery run long. The same
  doc wrote down a "deliberately deferred" map state that never
  shipped. The verb existed; it was never lifted above a phase.

- **The project level now exists as a pattern.** Baseline
  (2026-08-12) shipped the machinery a project-scoped, pipeline-less
  layer needs: reserved pseudo identity, project-manifest status,
  committed content under a dotted project dir, its own KB phase,
  status-keyed start-menu rows, graceful absence. Baseline answers
  "what already exists here?"; the roadmap is the forward-facing
  sibling: "what are we building, and in what order?"

- **The model maps onto how product development actually works** —
  Lee's test: if a model relates to real life, it's probably right.
  Real teams hold continuous product conversations that feed a
  roadmap; a backlog sits alongside; bugs bypass both. Here: the
  inbox is the backlog (raw), the roadmap is the staged layer
  (shaped), work units are delivery, and bugs/quick-fixes go straight
  through. Grooming is inbox triage onto the map.

## The shape

One deep conversation; the gate chooses its container truthfully; the
harvest sorts late; the pull is the commitment point.

```
              s/start → quick shape (fast, as today)
                           │
      ┌── product-altitude ┴─── a unit of work ────────┐
      ▼                                                ▼
PRODUCT ROAD                              INITIATIVE ROAD (today's
project-level sessions — durably          flow byte-for-byte: epic /
committed, NO work unit, no name          feature / bugfix / quick-fix;
yet (baseline proved the container)       logs live in the work unit —
      │                                   the truthful home, because
one deep exploration, hours if            the conversation IS about
needed, pausable, resumable               the unit)
      │  user pulls                                    │
      ▼                                   park valve: "that's v2" →
HARVEST — coarse: horizons + items        roadmap born lazily (JIT),
+ provenance pointers. No briefs,         one item, no ceremony; the
no topic shaping (far too early)          epic harvest also sorts
      │                                   two ways when parks landed
      ├── stop here: first-class.
      │   roadmap on disk, zero
      │   work units, resume later
      ▼
PULL — the commitment point: epic
born HERE, named here, fenced at
birth; pulled items = its seed set
      │
      ▼
epic discovery — real, as-much-as-
needed; ITS harvest shapes topics
and writes the briefs, once, from
the whole session chain
      │
      ▼
existing pipeline, unchanged
```

Not a phase, not a work unit: a project-level layer outside the
pipeline, like baseline. The pipeline itself is untouched.

## The decision

1. **The gate tell is product-altitude, with greenfield genesis as
   the paradigm case.** "I want to build X" (no product exists) and
   "let's lay out the next six months" (no single unit of work is
   being proposed) route to the product road; "add X to Y" /
   "overhaul the payments" route to the initiative road as today.
   The tell is *not* breadth (epics are broad too) and *not*
   readiness (you can be ready to build and still owe the product
   conversation first) — it is that the conversation is about the
   product's future rather than a nameable piece of work. An
   explicit type key (`e/epic` etc.) always wins and is never
   second-guessed.

2. **The gate is cheap to be wrong, in both directions.** Misread as
   epic → parks correct the staging as it surfaces; the logs stay in
   the epic (accepted residue on the misread road only). Misread as
   product → every item lands in the first horizon, one epic is born
   at the pull holding all of it, and the genesis record sits at
   project level — harmless, arguably a bonus. Small-greenfield and
   product-genesis paths converge on the same end state, so the
   read never needs to be perfect, only correctable.

3. **Logs live where the conversation happened — and the gate
   choosing truthfully is what makes every home honest.** Product
   conversations record in project-level session logs; initiative
   conversations record in the work unit, as today. This resolves
   two smells with one root: the genesis record banked inside epic 1
   (wrong home), and product talk being "out of scope" inside epic
   discovery (wrong altitude). Both came from choosing the container
   before the conversation revealed its altitude. In real life
   nobody agrees epic 1 and then holds the initial product
   conversation inside it.

4. **The product harvest is coarse: horizons + items + provenance
   pointers. No briefs. No topic shaping.** Topic shaping (the
   granularity discipline: independence tests, routing) is far too
   early at product level and is deliberately not loaded. Naming an
   item is not topic shaping — the test is different and looser: *a
   roadmap item is whatever chunk you'd move around a roadmap as one
   thing.* Capability-grain — "loyalty", "white-label" — which may
   turn out to be a topic, three topics, or a whole epic; nobody
   knows yet and nobody needs to.

5. **Work units are born at the pull, when the fence is known.** The
   pull is the commitment point (borrowing upstream-kanban language:
   everything left of it is options, cheap to reshuffle). Grouping
   is decided here — N items → one epic; one item → an epic or a
   feature — and the unit is named here, at fence time, never
   before. Contrast today, where the epic is created first and then
   scoped by whatever the exploration says afterwards.

6. **The pull seeds material, not topics.** Pulled items land as the
   epic's seed set; the epic's discovery map starts empty, exactly
   like a new epic under `macro_continuation` today. Epic discovery
   is real — real life hands an epic to a team and says "go explore,
   pull this apart; we roughly know the shapes" — and as-much-as-
   needed: five minutes ("looks right, harvest it") or five hours
   (new threads, splits, parks back up, strays to the inbox). Its
   harvest shapes the actual topics.

7. **One session chain, two homes; continuity-load spans it.** The
   product sessions and the epic's sessions are one continuing
   exploration whose logs live at two levels. Epic entry
   continuity-loads the product sessions its seed items point to.
   The same-session pull has no transfer problem at all — the
   conversation is still in context; the epic's session-001 gets its
   Exploration backfilled with the fenced slice (the
   `macro_continuation` move, verbatim).

8. **Briefs are written once, at topic shaping, from the whole
   chain.** The epic's harvest runs brief-synthesis exactly as
   today, except its source material is product logs + epic logs
   instead of epic logs alone. The summarisation ladder stays two
   rungs deep, as today: session log (the one summary of the
   verbatim) → brief (the one distillation of the logs). The product
   level never writes briefs — rejected as
   summary-of-a-summary-of-a-summary (see Rejected shapes). A
   roadmap item pulled a year later gets its briefs the same way:
   continuity-load the sessions its pointers name, converse, harvest,
   brief — the richness was never flattened in the interim because
   nobody summarised the logs until a topic existed to be briefed.

9. **The hand-down is three carriers, never a transcript copy.**
   (a) the seeded items — identity and join; (b) the items' `sources`
   pointers — the index into the record; (c) the session-001
   Exploration backfill — conversational continuity. Verbatim
   copying is banned for three standing-doctrine reasons: *record vs
   view* (a copy is a second record, and one of them decays); *the
   fence* (most of the product conversation is deliberately not-MVP;
   copying re-imports the scope the harvest just fenced out); and
   *reachability* (product logs are KB-indexed — later phases query
   back to the source as they do for everything upstream).

10. **The roadmap is born lazily (JIT).** No genesis ceremony is
    required: the first park creates it — one item, one horizon, no
    ceremony. This is what makes the layer safe from every angle: a
    project that never says "later" never sees it. On the product
    road it is born at the harvest deliberately; on the initiative
    road it is born by the first park.

11. **The park valve is available wherever staged signal appears** —
    epic discovery's session loop (which today has no parking
    mechanism at all: scope-down-to-inbox lives only in
    detection-core) and discussion (which already reroutes off-topic
    concerns with `reroute:{origin}` provenance; the park is the same
    shape aimed at the roadmap). A park is capture-weight: a
    one-liner, a horizon, a provenance pointer — never shaping.
    Grooming happens later at product altitude. The valve is named
    in the flow guidelines so the mechanism is discoverable, not
    tribal knowledge.

12. **Park vs inbox: the bucket is the ticket.** If the utterance
    places the thing on the timeline ("that's a v2 thing") it parks
    to the roadmap with the stated horizon; an unplaced thought ("we
    should think about gift cards sometime") goes to the inbox; a
    concern belonging to existing in-flight work takes today's
    triage reroute. Claude may propose the placement; the user
    confirms the horizon (placement is a product call —
    cone-of-collaboration territory). **When ambiguous, inbox** —
    the asymmetric default: grooming promotes inbox → roadmap
    cheaply, whereas a wrong horizon on the roadmap looks like a
    decision someone made.

13. **Inbox = backlog; bugs bypass.** The inbox stays deliberately
    dumb (raw capture); the roadmap holds product capability only —
    shaped and placed. Ideas gain a destination at triage: groomed
    onto the map (or archived). Bugs and quick-fixes never touch the
    roadmap: inbox → work unit, as today.

14. **Recognition pass at shaping.** When new work is being shaped,
    match it against both prior homes and offer, softly, on a hit:
    a roadmap match → "loyalty is on your roadmap (v1) — pull it
    from there so the record comes along?"; an inbox match → "you
    logged 'checkout race' on 12 Jul — read it in as the seed?"
    The inbox side fixes an observed, recurring loss (forgotten
    inbox items silently duplicated). Both lists are small; the
    check is cheap; one soft question, only on a match. Without the
    roadmap check you get twins — a fresh feature beside a waiting
    item, record stranded.

15. **Pull-forward expands an in-flight epic.** "Actually, bring
    loyalty into MVP" re-buckets the item and joins it to the epic.
    Post-harvest: it lands directly as a map topic (source:
    roadmap). Pre-harvest (epic still fresh, map empty): its record
    joins the conversation as seed material and it crystallises at
    the harvest *as itself* — the anti-twin rule: an item pulled
    pre-harvest keeps its identity through the harvest, never
    duplicated beside itself.

16. **The epic harvest gains the two-destination sort.** Items
    surfaced during epic exploration sort into "this epic" (topics)
    or a horizon (roadmap) in the same proposal and adjust loop. The
    park valve is the mid-conversation form of the same sort.

17. **Lifecycle by join, never stored.** A pulled item carries
    `pulled_to`; its display state is computed at render by joining
    against the work unit (and topic) it became — waiting / in
    flight / shipped — the same trick the discovery map uses one
    level down (topics joined against phase items). Nothing is
    recorded twice, so nothing can disagree. "Waiting" is not a
    stored value — it is the *absence* of a join. The whole chain is
    asked hop by hop at render time — roadmap row → work unit →
    phase items → tasks — the way a CEO asks a manager, who asks the
    tech lead, who asks the devs; only the bottom of the chain
    stores anything.

18. **Horizons are user-named, ordered, and soft.** The concept word
    is *horizon* (industry term — Now/Next/Later roadmapping;
    "bucket" survives only as conversation shorthand; stage / phase
    / tier are all taken by the system). Names shape from the
    user's own conversation language: now/next/later runs as a
    conversational current Claude listens for — never a leading seed
    — and the early soft reads crystallise at the harvest into the
    project's own names (MVP, V1, V1.5, someday…). A default set
    (Now / Next / Later) is offered as a suggestion only when no
    staging language emerged. Position carries the semantics (first
    = next up); "someday" is the conventional tail, not a special
    case. Horizon ops: rename, reorder, insert, merge, split —
    including splitting one horizon's contents into two when it
    turns out to be bigger than one release.

19. **Data shape: state on the project manifest, substance in the
    logs, connected by pointers.**

    ```json
    "roadmap": {
      "horizons": ["mvp", "v1", "someday"],
      "items": {
        "loyalty": {
          "horizon": "v1",
          "summary": "repeat-customer rewards to drive reorders",
          "sources": [".roadmap/sessions/session-001.md", ".roadmap/sessions/session-003.md"],
          "origin": "harvest",
          "pulled_to": { "work_unit": "v1" }
        }
      }
    }
    ```

    `summary` is a one-liner only — the discovery map's precedent;
    anything longer is content, and content is banned from
    manifests. `sources` are provenance pointers (an index, not a
    summary — zero loss because they distil nothing). `origin` is
    `harvest` | `park:{origin}` | `inbox:{slug}`. Item substance is
    never in the manifest: it is the pointed-at session logs. The
    product session log template gains a harvest section (the analog
    of Topics Identified) recording what was sorted and why, in
    prose, in the log where the reasoning lives. Removal is
    deletion — git history and the logs keep the story; no dismissed
    list until product-level analyses exist to nag (none are).

20. **Product sessions live in a project-level dir, KB-indexed under
    a reserved pseudo identity** — the baseline pattern (dotted dir,
    committed content, pseudo work-unit carve-out, own KB phase).
    Settled at build kickoff (2026-08-17): **roadmap everywhere** —
    dir `.workflows/.roadmap/` (sessions inside), reserved identity
    `roadmap`, manifest node `roadmap`, chrome "Roadmap"; one word
    for the whole layer, the baseline one-name precedent. The
    indexing grade matches discovery session logs (the record of a
    conversation), not baseline's advisory-low. The product road's
    opener reads `.workflows/.baseline/overview.md` in full when it
    exists, exactly as discovery's opener does — baseline is the
    past, the roadmap is the future, and both are ambient at product
    altitude.

21. **The start screen has three product states; empty only when
    truly nothing.** (a) *Mid-conversation exit*: a first-class
    resume row (active-session marker → resume-detection →
    continuity-load — discovery's own machinery, project-level
    home). (b) *Harvested, no work units*: the roadmap section plus
    keys to continue the product conversation or pull a slice — this
    is the "stopped after shaping, came back later" state, and it
    must never render as an empty screen. (c) *Work in flight*:
    today's overview plus a join-computed roadmap section
    (`mvp ◐ in flight · v1: 2 · someday: 1`). Menu presence is a
    **management surface** (view, edit, groom, re-enter the
    conversation); *entry* into genesis shaping is detection-driven
    via `s/start`. Before any roadmap or product session exists
    there is no row — the road is reached by detection.

22. **Post-launch product chats are the same loop re-entered.** Next
    session in the chain; catch-up open via continuity-load over
    recent product logs + the map + KB over shipped work units; the
    user brings the new signal (customer learnings, a pivot). Edits
    are map operations — insert an item, demote v1 → v2 because
    something more important arrived, re-bucket, rename — mid-loop
    or at harvest. Then stop, or pull the next slice. Real life
    preserved: product conversations are always available, always
    feed the map, and the map feeds work — while "I know what I
    want, just build it" goes straight to a feature with only the
    recognition pass watching.

23. **The dormancy gradient is a design invariant.** A bug touches
    nothing; a feature touches one soft advisory (recognition, only
    on a match); a small greenfield converges with the epic path and
    never sees a roadmap until its first "later" thought; a full
    product uses everything. The layer exists in proportion to the
    project's staged ambition.

24. **Suggest-never-auto throughout.** Horizon placements, pull
    offers, recognition matches, harvest sorts — Claude proposes,
    the user confirms. The product level is the widest end of the
    cone of collaboration.

25. **The pull cuts authority, not awareness.** Left of the pull the
    map is authoritative and loose; right of it the work unit is
    authoritative and the item's row is a computed window (the
    join). Signal still crosses the line — as a flag or a reroute,
    never as an edit (the no-gap-editing rule holding at one more
    boundary; existing propagation doctrine verbatim: "a signal, not
    a rewrite — soft can prompt re-examination; it can never
    overwrite hard"). Mechanics, all reuse: (a) *the join routes new
    signal* — the bucket-is-the-ticket test (decision 12) gains a
    branch: a thought about a pulled, in-flight item is a concern
    for the owning epic — topic-triage reroute — never a park;
    (b) *a product harvest that materially deepened ground under a
    pulled item* sets `reconcile_needed` on the epic's item —
    `flagDownstream` semantics, surfaced and cleared by the existing
    reconcile advisory; (c) *re-bucketing or removing a pulled item
    is refused bare* — "demote loyalty to v2" while loyalty is in
    flight means "stop building this", a delivery decision; the
    engine refuses, names the join, and the confirmed path goes
    through the epic-side cancel (cancel-cascade mirror), whose
    revert returns the item to waiting. Revert semantics (settled
    2026-08-17): cancelling a joined topic — or the whole work unit
    — deletes the affected items' `pulled_to`; they render waiting
    again with `sources`/`origin` intact, re-sorted at the next
    catch-up; nothing ever reads as shipped that wasn't. Session
    logs never correct
    (decay doctrine — history, not claims); un-pulled items drifting
    from post-launch reality re-sort in conversation at the catch-up
    — human-paced grooming, no nags.

26. **Product-road imports land at project level.** The opener's
    import weave is universal and unchanged — chat outside, produce
    a doc, hand the path over, it is read for shaping and landed as
    an import. With no work unit yet, files shared at a
    product-altitude opener land in a project-level imports home,
    KB-indexed — the parked phase-17 "project-level imports"
    facility realised on this road. External seed docs (the
    Claude-app bridge) remain first-class: the workflows require a
    named directory and repo, and an idea can predate its own name.

27. **No mirroring — one home per fact.** The roadmap never mirrors
    the epic's internals. Detail of what was pulled (topic splits,
    gap-analysis finds) stays inside the fence — no roadmap row; the
    roadmap says "in flight" and what the epic contains is the epic
    map's business, one level down (real roadmaps are always coarser
    than delivery reality). A genuinely new capability surfacing
    mid-epic sorts at the valve or harvest — "this epic" (the fence
    grew, deliberately; still no map row) or a horizon (park; map
    row created, epic untouched). Capability staging lives on the
    map, exploration structure on the epic's map, delivery state in
    the phases; the join is the only thread. Noting a fact in two
    homes is double bookkeeping — what lifecycle-by-join exists to
    prevent.

28. **Item operations split by the join; the add flow is strict once
    a horizon is fully in delivery.** Un-pulled items are the loose
    zone — add, edit, rename, re-bucket, remove, merge, split, any
    time, from anywhere (park, direct add, harvest, grooming).
    Pulled items: summary edits are cosmetic (the row is a window);
    re-bucket and remove are refused bare (decision 25c); reshaping
    happens in the epic. Horizon ops (rename, reorder, insert,
    merge, split one into two) run any time and are presentational
    for joined items — a horizon of shipped items is the record of
    what that release was. Adding to a *joined* horizon is a routed
    confirm keyed on its composition: while the horizon still holds
    waiting items (release still being composed) the add may land
    waiting beside them, join a delivery container, or go elsewhere;
    once the horizon is fully in delivery the confirm is strict
    two-way — into the epic (as a fresh topic, full phase
    discipline) or another horizon. No waiting side-door into a
    release that is now an epic. **Stretch scope is epic machinery,
    never a map state**: a "if there's room" item enters the epic as
    a fresh topic (visible to delivery, unstarted), and at wrap an
    untouched stretch topic is cancelled — the revert hands the item
    back to the map, waiting, re-sorted at the next catch-up. Fresh
    topic + cancel + revert: all existing parts. Underneath all of
    this: **the pipeline is the guard, not the map** — a late
    addition lands as a topic and cannot reach implementation
    without passing its phases (discussion → spec → planning, soft
    gates and spec entry hard-blocks included). A new topic entering
    while siblings are mid-implementation is already normal epic
    life; the map's job is only to make the choice explicit and
    route it to the owning container, never to refuse the product
    owner's call or let it bypass the pipeline.

29. **Horizon ≠ epic — the pull is item-selective.** A horizon is a
    release label over items, not a delivery container; it drains
    through as many pulls as it takes. Partial pulls are first-class
    (three items → epic `mvp-core` now, two wait for a later pull),
    so "waiting beside in flight" is the truthful render of a
    partially delivered horizon — derived, never stored. Multiple
    units per horizon fall out naturally: sequential is the default
    the pull ceremony assumes, overlap is not forbidden (the system
    already runs concurrent work units under presence awareness) but
    never encouraged. Horizon completion is computed — every item
    shipped or removed — with no stored release state. Naming an
    epic after its horizon is the natural case when one pull takes
    the whole horizon, incidental otherwise. Cross-horizon pulls are
    legal without extra rules: items are the atoms, each keeps its
    horizon, each joins whatever unit took it. A horizon never
    versions — "MVP 2" is a second unit pulled from the mvp horizon,
    not a new horizon.

30. **The pull ceremony is a working set; the fence governs
    synthesis, not the reading.** The pull renders the roadmap's
    items and takes a multi-select — the inbox pickup's established
    interaction, on a new surface — then the grouping confirm (which
    unit(s), unit name). The pull takes whole items (settled
    2026-08-17): wanting half an item means the item is two items —
    split it on the map first (the split op exists); the ceremony
    points at the split, never performs it inline. The remainder is named at the moment of
    choice ("3 items stay waiting in mvp") so a partial pull is
    never silent. Downstream, the epic's continuity-load reads whole
    sessions, so material about un-pulled items will pass through
    context — *reading is broad, synthesis is fenced*: the epic's
    seed set is the fence, and topic-synthesis's proposal validation
    (today's `exists_on_map` check) gains a sibling — **a proposal
    colliding with a waiting roadmap item is never created as a
    fresh topic**; the gate offers the real move instead
    (pull-forward, or leave it waiting). Deliberate expansion stays
    possible; accidental twins become impossible. Un-pulled items
    return **by visibility, never by memory or analysis**: they
    never left — the overview shows `mvp: 2 in flight · 3 waiting`,
    the completion catch-up names the remainder, and the next pull
    takes them with their `sources` pointers intact. The map is the
    memory; nothing re-proposes, nothing nags.

## Rejected shapes along the way

The design went through four versions; the rejected ones are recorded
so they aren't re-derived.

- **v1 — a second conversation layer above the epic** (product
  shaping, then epic shaping). Rejected: the two layers are the
  *same activity* (curatorial exploration with a harvest), separated
  only by scope — and scope is precisely what can't be judged early.
  Research and discussion differ in kind and still leak into each
  other; this line would leak worse, and we'd build triage machinery
  for a boundary we invented.

- **v2 — re-home the whole conversation, gate on a readiness tell**
  ("am I starting work or just thinking?"). Superseded: readiness
  misreads — you can be ready to build and still owe the product
  conversation first. Its container insight survives (decision 3).

- **v3 — lazy epic-first for genesis** (read greenfield as epic,
  park corrects everything, item briefs written at the product
  harvest). Rejected on two counts. *Container*: the genesis record
  banked inside epic 1 and product talk "out of scope" in the epic
  are one smell — the container chosen before the conversation
  revealed its altitude; real life never agrees epic 1 and then
  holds the product conversation inside it. *Briefs*: item briefs at
  the product harvest plus topic briefs at the epic harvest is a
  summary of a summary of a summary (the session log is already a
  summary of the verbatim) — unacceptably lossy. JIT survives as
  the initiative road's mechanism (decision 10); briefs-once
  survives as decision 8.

- **A fattened inbox as the staged home.** Rejected: the inbox is
  deliberately dumb capture; making it the shaped, staged record
  contorts it. Its promotion mechanics are reused by the pull
  instead.

- **Fixed horizon vocabulary, dates, milestones.** Rejected: the
  user's own names, orderable, date-free. Dated roadmaps rot into
  fiction (Now/Next/Later practice exists because of this).

- **Ceremony borrows considered and declined (for now):** a
  staleness cue at catch-up ("these someday items are six months
  old") — Lee grooms manually and the reminder would annoy;
  a post-launch retro beat at epic completion — Lee retros
  naturally, and end-of-epic is when you want to finish, not add
  ceremony. Scoring frameworks (RICE/ICE), sprint mechanics, PI
  planning, OKR cascades, opportunity solution trees — weight
  without payoff at this scale. Any of these can be circled back to.

## Real-world cross-check

Landed shape matches established practice arrived at independently —
Lee's if-it-maps-to-real-life test:

- **Now/Next/Later roadmapping** (ProdPad): horizon-based, date-free
  — our decisions 18 and the rejection of dates, exactly.
- **User story mapping** (Patton): lay out the whole, then cut a
  release as a horizontal slice — our sort-late-at-the-harvest.
- **Upstream/discovery kanban**: a named commitment point; options
  left of it are cheap to reshuffle — our pull, and cheap-to-be-
  wrong is the left-of-the-line property.
- **Continuous discovery** (Cagan, Torres): product conversation
  runs permanently alongside delivery — the always-re-enterable
  product loop plus parks-from-anywhere.

## Scenarios

1. **Greenfield genesis → MVP + v1.** `s/start` → product-altitude
   read → project-level sessions, hours of exploration → harvest:
   `mvp: ordering, menu-management, kitchen-display · v1: loyalty,
   analytics · someday: white-label`, horizons named from the
   conversation's own language → stop (first-class; roadmap on disk,
   zero work units) or pull MVP → epic born fenced, seed set +
   backfill, thin-or-deep epic discovery → topics + briefs from the
   whole chain → pipeline. Months later: overview shows
   `mvp ✓ · v1: 2`; pull v1.

2. **Greenfield, small — everything is "now".** Reads as epic →
   today's path byte-for-byte, roadmap never born (unless a "later"
   thought parks one item). Reads as product → harvest lands
   everything in one horizon → pull takes it all into one epic.
   Same end state either way — the convergence that makes the gate
   safe.

3. **Brownfield feature.** Today's path plus the recognition pass:
   a roadmap or inbox match gets one soft offer to pull/read-in;
   otherwise untouched. Mid-feature tangents go to the inbox as
   today.

4. **Brownfield bug.** Inbox → bugfix → investigation pipeline.
   Roadmap never consulted. Zero interaction by design.

5. **Read as epic, product emerges mid-conversation** (very likely
   in practice). Parks fire as staging language appears; the roadmap
   is born lazily; the epic harvest sorts two ways; the end state
   converges with the genesis mainline — one fenced epic plus a
   roadmap. Only the degenerate case (nothing in the epic is "now")
   needs surgery: park everything, cancel the epic.

6. **Expanding an in-flight epic.** New thread in epic discovery →
   belongs here (topic at harvest) / staged later (park) / already
   on the roadmap (pull-forward — post-harvest as a topic, pre-
   harvest as seed material crystallising with its identity, the
   anti-twin rule).

7. **Post-MVP product chat.** `p` → session N+1 of the chain →
   catch-up (map + logs + KB over shipped units) → pivot talk,
   insert item, demote v1 → v2 → harvest re-sorts → stop or pull.

8. **Return-visit v1 pull, much later.** Items' `sources` pointers
   name the product sessions to continuity-load at epic entry; the
   conversation adds what launching taught; the harvest briefs from
   all of it — no summary was taken in the interim.

9. **Partial pull and the follow-up unit.** Five items in mvp; the
   pull's working set takes two → epic `mvp` fenced to those, "3
   items stay waiting in mvp" said at the gate. While the epic runs
   the overview reads `mvp: 2 in flight · 3 waiting`; its harvest
   refuses twins of the waiting three (offers pull-forward instead).
   At completion the catch-up names the remainder; the next pull
   takes them into `mvp-2` (or re-sorts some to v1 first) with their
   pointers intact.

## Engine surface (sketch)

- Project-manifest `roadmap` node (decision 19) + field-surface
  access; reserved pseudo identity + KB phase for product sessions;
  session-log template with harvest section.
- Verbs: park (item + horizon + provenance, JIT-creates the map),
  pull (working-set select → join + seed hand-off into
  `workunit create`), pull-forward, horizon ops (rename / reorder /
  insert / merge / split), item ops (re-bucket / edit summary /
  remove — with the re-bucket/remove guard on joined items,
  cancel-cascade mirror), the cancel-revert hop (epic-side topic
  cancel returns the item to waiting), the `reconcile_needed` flag
  across the join (`flagDownstream` extension), roadmap render
  surfaces (map view, proposal view, pull working set, the
  add-to-joined-horizon routed confirm, start-screen states and
  rows), a `waiting_on_roadmap` collision flag in the epic-harvest
  proposal validation, and the project-level imports home.
- Prose: detection-core gains the product-altitude tell; the product
  road's session loop (reuse of discovery's loop + guidelines with a
  product-level delta); park valve named in epic session-loop and
  discussion guidelines; recognition pass at shaping; pull ceremony;
  epic-harvest two-destination sort; continuity-load across the
  chain.
- Simulation coverage per the house rule; prose cases for the
  genesis walk, the park, the pull (full and partial), the
  recognition pass, and the three start-screen states.

## Build plan (2026-08-17)

Stacked on this log (PR 1, #915), engine-up like the baseline stack.
Every engine slice extends the pipeline simulation; every prose slice
ends with `prose select --diff` per the house rule. No migration —
the layer is additive; the roadmap node and the project-level dirs
are created on first use (JIT), and no existing state translates.

1. **#915 — this design log** (open).
2. **Engine: roadmap state + local ops.** The project-manifest
   `roadmap` node, `domain/roadmap.cjs` (horizons, items, join
   lifecycle derivation), field-surface access, reserved identity,
   park / direct add / item ops / horizon ops, the re-bucket/remove
   guard on joined items. Engine tests + simulation scenario.
3. **Engine: pull + cross-boundary hops.** The pull verb
   (working-set input → joins + seed hand-off into
   `workunit create`), pull-forward, the cancel-revert hop on topic
   cancel, `reconcile_needed` across the join (`flagDownstream`
   extension), the `waiting_on_roadmap` collision flag in proposal
   validation. Simulation permutations for partial pull, revert,
   and the guards.
4. **KB + product sessions.** Project-level sessions dir + log
   template (harvest section), session open/close verbs at project
   level (active-session marker), KB phase + `deriveIdentity`
   carve-out, project-level imports home. Knowledge suites.
5. **Render surfaces.** Roadmap view, harvest proposal view, pull
   working set, add-to-joined-horizon routed confirm, the three
   start-screen states + overview roadmap section, boot/gateway
   reporting. Simulation render assertions.
6. **Prose: the product road.** A separate model-only skill
   (settled 2026-08-17 — the baseline precedent; discovery stays
   two-mode), reusing discovery's shared references where the loop
   overlaps: detection-core product-altitude tell + routing, opener
   (baseline overview read, imports weave), product session loop +
   guidelines delta, product harvest ceremony, resume detection at
   project level.
7. **Prose: pull + integrations.** Pull ceremony, epic-entry seed
   set + continuity-load across the chain + Exploration backfill,
   epic-harvest two-destination sort + anti-twin check, park valve
   in epic session-loop and discussion, recognition pass at shaping,
   workflow-start rows and states wiring, post-launch catch-up.
8. **Prose tests.** Cases: genesis walk, park (epic + discussion),
   pull (full + partial-horizon), recognition pass, the three
   start-screen states; run the intersecting-case selection.

Decisions owed before their slice: naming (slices 2/4), cancel-revert
semantics (slice 3), the product road's skill shape (slice 6),
partial-item pull handling (slice 3 refuses or splits). Recognition
fuzziness settles inside slice 7; KB grade inside slice 4.

## Open questions

Settled at build kickoff (2026-08-17), recorded in their decisions:
naming — roadmap everywhere (decision 20); cancelled-topic revert —
revert to waiting, sources intact (decision 25); partial-item pulls
— refuse, split on the map first (decision 30); skill shape —
separate model-only skill (build plan, slice 6); KB grade —
record-grade like discovery logs (decision 20).

Settled in slice 6: product-road guidelines — a thin
`roadmap-guidelines.md` loads discovery-guidelines cross-skill (one
source of truth for the register) and states the altitude deltas;
the gate tell is encoded in detection-core as discriminator step 0
(product-altitude: no single unit of work on the table) with the
product↔epic pivot rows; the pull's epic path re-enters discovery
under a `pull_continuation` flag (resume-detection skips its menu,
the session loop opens on the fenced slice).

Settled in slice 7: recognition — the opener reads both indexes
silently (roadmap state + live inbox filenames), the detection core's
new section J matches the converging shape by name and theme with
judgment (a match earns one soft question, a miss earns silence), a
roadmap match offers `/workflow-roadmap pull` (a third dispatch
mode), an inbox match joins `inbox_seeds` through the normal landing.
The park valve landed in epic discovery's session loop and both
discussion off-topic flows; the epic harvest carries the two-way sort
(park set + pull-forward set, the `waiting_on_roadmap` anti-twin
flag) persisted at A2 of confirm-and-persist; the reconcile advisory
gained its `roadmap` branch.

Settled in the review pass (2026-08-17), each ruled with the user:

- **The bind's landing** — the epic harvest is the closing move
  (confirm-and-persist A2): every unit-grained join binds to the topic
  its ground crystallised as; a split binds to the identity-carrier.
- **The add-to-joined-horizon confirm** fires on any joined member
  (composition, per decision 28) and is wired in the product session's
  prose with all three answers; the park valves stay ungated — parks
  are cheap-to-be-wrong, groomed at the next product session.
- **Absorb re-aims joins** at `{epic, topic}` — the un-pull is
  cancel's move; absorbed work moved, it didn't stop.
- **The stretch un-pull** — `discovery-map remove` of a fresh topic
  holding a join reverts it, completing decision 28's wrap story for
  never-started topics.
- **Pre-harvest pull-forward** ships in its post-harvest form
  uniformly — the map topic is created immediately; the harvest's
  `exists_on_map` guard keeps the end state identical to decision 15's
  seed-material path, so the second path was dropped.
- **Anti-twin scope** — the advisory flag on the harvest-proposal path
  is the mechanism; themed collisions are the gate's judgment, and
  analyses/direct adds are legitimate epic-internal overlap, not
  twins. Decision 30's "impossible" reads as "never silent".
- **Horizons render as stored** — the user's own release words, never
  recased.
- **The parks-only harvest** gates with its own park-labelled confirm;
  briefs regenerate only on yes.

Still open:

- **Multiple products per repo** — out of scope; one product per
  project assumed.
