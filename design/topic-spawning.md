# Topic Spawning — route in the moment, retire the boot-time research analysis

How material leaves a research session: threads route to their owning
topic the moment they surface, new topics spawn without moving content,
and the per-file boot-time analysis that papered over the gaps retires.
This is the design log. Opened 2026-08-25.

## Motivation

### The incident this starts from

A Fumi session concluded `space-homing` research. At the bridge, the
`research-analysis` cache was stale, so the analysis read the completed
file, found an unsized scale/performance thread, and staged one
candidate. The user approved it — and was then hit with:

```
Derived from research "Space Homing". Mark "Space Homing"
handled — fanned out, keep on the map but stop prompting to discuss it?
```

The author of these workflows did not know what "fan-out" meant, what
"handled" would do, where the offer came from, or what saying yes would
cost (answer: the topic becomes terminal and stops blocking `all_done` —
the epic could complete with `space-homing` never discussed). Three
explanation attempts were needed. A gate whose author cannot answer it
is a design defect, not a documentation defect.

### The archaeology

`research-analysis` dates to February 2026 — the `start-research` era,
before the discovery map existed. Its own prose still says *"This
analysis is the foundation for every downstream phase. The themes
extracted here drive topic definition"* — a literal description of the
exploration-era world, where one broad research pass was the topic
generator and was expected to fracture into children ("fan out"). In
today's design that sentence is false: discovery generates topics;
research is scoped per-topic. The analysis runs an obsolete job
description, and the fan-out offer asks an exploration-era question
(has the parent been emptied into children?) that the current system
can no longer produce a yes to — content never moves out of a research
file post-completion.

`topic-splitting.md` is the same era's other survivor. Its trigger is
sustained drift; its move is verbatim content extraction into a child
file no session of the child's own ever examined; its prose claims the
split "writes the superseded parent" while the flow never calls
`topic supersede` at all.

### The principle that settles it

Triage exists because it is not our place to put knowledge directly
into another topic's session — a concern lands in the target's queue
and is worked there, in context, by its own session. Content is
authored once, in its own session, and travels **by reference**:
read-in-full where declared (name-match, provenance parents), KB slices
otherwise, queue entries for obligations. Research-analysis, topic-
splitting, and the fan-out offer all violate or obscure that invariant:
the first two transplant or re-derive content outside its session; the
third asks about a state (an emptied parent) the invariant makes
unreachable.

The pipeline structure supplies the second principle: **there is no
research→spec edge**. A specification's sources are discussions.
Research facts reach the product only through a discussion that
ratifies them into decisions. So "research settled everything, nothing
to discuss" is not a state this pipeline can use — if the facts matter
under this topic's name, a discussion is owed by construction. The only
honest no-discussion terminal is the dead end.

## The model

Three moves cover everything that leaves a research session. Two exist;
one is sharpened.

1. **A thread belongs elsewhere** → triage, exactly as discussion does
   it today. Existing target → its queue; no target → a new map item is
   created (`triaged` stub or fresh item). Queue files carry rich
   material; the target's own session works it in context.

2. **A thread has grown into its own topic** → **spawn**: create the
   child map item with provenance (`source` naming the parent) and a
   distilled summary + description pointing at where the material
   lives. Content **stays in the parent's file** — the honest record of
   what that session explored. The child feeds from the parent by
   reference: description + KB at child research; parent read in full
   at child discussion (the provenance walk). Precedent: the deep-dive
   path already spawns topics exactly this way, without extraction, and
   nobody ever missed it.

3. **Nothing to carry forward** → the **dead end**: research concluded
   and the finding is that this topic gives the product nothing under
   its own name — the thread didn't pan out, or its facts serve only
   other topics (where provenance and the KB already deliver them). The
   file remains — completed, indexed, provenance record and seed
   material. The *topic's* forward motion ends: marked with the
   existing `handled` marker, relabelled in plain words. One meaning,
   one conversational entry point (the conclude flow offers it only
   when the session's own conclusion points that way; the user's
   confirmation in the moment is the ratification). `handled` — not
   supersession — because `topic supersede` removes KB chunks, and
   under this model the parent file remains the content holder;
   removing its chunks would starve every consumer.

States that died under scrutiny, kept here so they stay dead:

- **"Carried by its children"** — only reachable when content
  physically moved out, leaving a husk. With content never moving, the
  parent always retains what it explored and is judged at conclusion
  like anyone else: does anything need a decision *under this name*?
- **"Settled by research — no discussion needed (facts ratified)"** —
  no research→spec edge exists; ratification without discussion is
  structurally impossible.
- **Supersession as a split outcome** — nothing splits anymore.
  Supersession stays reserved for flows that genuinely replace content
  wholesale.
- A mislabeled-but-coherent topic is a **rename** (existing map op),
  not a decomposition.

### Why an empty research file is unreachable

Triage routes *threads* — a concern, a pulled string, sometimes a
foregone conclusion to be ratified in the target's phase. It never
moves the research's own material. Spawn copies nothing. So the
artifact retains everything it explored regardless of how much got
routed, and every design that assumed a hollowed-out parent (the
fan-out offer, the supersede-after-split gate) was designing for a
state that cannot occur.

## What changes

### 1. Research-analysis deleted, whole

- `workflow-shared/references/research-analysis.md` deleted.
- Approval gate section D (Fan-Out Parent-Handled Offer) deleted, with
  the `fanout_offer` field validation in `fields.cjs`.
- Engine: research-analysis cache-status computation
  (`epic-detail.cjs` `buildAnalysisCaches`, `cache.cjs`), the
  gateway's `analysis_caches` research half, dispatch wiring in
  `topic-discovery-dispatch.md` / `topic-discovery.md`.
- Migration NNN: clear stranded `analysis_staging.research-analysis`
  subtrees (idempotent; node/fs direct, never `engine manifest`).
- Gap-analysis survives untouched as the only boot-time analysis — its
  input set is completed research **and** discussions, and its category
  2 ("research themes not addressed by any discussion") is the holistic
  catch-net that outlives the per-file pass.

### 2. Defer deleted, whole

The approval gate (now gap-analysis only) loses its lead-in
review/defer STOP: the one-line count, then straight into candidate 1.
Per-candidate menu stays `y / a (auto) / s (skip, permanent) /
comment`. Rationale: route-in-the-moment has no "came for something
else" moment, and map adds are cheap and reversible; skip remains the
permanent decline.

### 3. Route in the moment — the replacement for the catch-net

Three edits, all reusing existing machinery:

- **Shared surfacing section H** (`background-agent-surfacing.md`): a
  route target may be a **new topic name**, not only an existing owner
  — `triage-landing.md` already creates it. One edit, fixes research
  and discussion at once.
- **Research review-agent lane guidance**: a thread outside this
  topic's remit that no topic owns goes to the `route` lane with a
  proposed name — never written into the artifact as "unexplored".
  (The route lane already exists in research's declaration; what's
  missing is the rule that unowned threads belong in it.)
- **The no-residue rule** (research and discussion conclusion): a
  completed artifact carries no unowned threads. Every gap the final
  review surfaces is explored now, routed to its owner (existing or
  newly created, confirmed with the user), or roadmap-parked.
  "Unexplored:" prose stops existing. Research isn't done for fun —
  unexplored material serves nobody.

This is where the Fumi scale thread lands under the new design: the
final review names it, the user confirms "make it a topic", it lands on
the map with provenance, the parent concludes clean. No boot-time
analysis, no staging, no offer about the parent.

### 4. Off-topic reroute becomes one shared reference

Discussion's `off-topic-epic.md` — the newer sibling: roadmap-park
branch, resolve-the-target-yourself doctrine — moves to
`workflow-shared/references/`, parameterised by phase. Discussion and
research epic sessions both load it; research's older inlined copy in
`epic-session.md` §B (confirm-with-the-user doctrine, no roadmap park)
is deleted. The non-epic off-topic path gets the same parity check
during implementation. Shared behaviour lives in shared references —
that is what they are for.

### 5. Topic-splitting deleted, spawn replaces it

`topic-splitting.md` deleted, not rewritten. Its drift trigger's
replacement in convergence routing:

- drift at snippet scale → the shared off-topic reroute (triage);
- a grown thread → a **spawn offer**, shaped like the deep-dive's
  existing `create-discovery-topic.md` path: name confirmed, map item
  created with provenance + distilled summary/description, content
  stays put. Consequences stated in the offer.

The supersede-after-split transaction from earlier drafts is withdrawn
— nothing empties, so nothing closes.

Design detail: the spawn's `source` value. Options: reuse
`research-split:{parent}` for continuity, or an honest new name (e.g.
`spawn:{parent}`) with the old value kept render-valid for existing
maps. Decide at implementation; either way the provenance walk (§7)
must recognise it.

### 6. `handled` — kept, one job, plain words

- The words "handled" and "fanned out" leave every render surface.
  New label direction: *"dead end — nothing to carry forward; research
  kept as record"*.
- One conversational entry point: the research conclude flow offers it
  only when the session's own conclusion is that the topic goes no
  further — never automated, never per-candidate. The offer explains
  consequences: leaves the epic's to-do view, stays on the map and in
  the KB, reversible (`unhandle`).
- The conversational map op ("mark X handled") keeps working,
  rephrased to the new vocabulary.
- Field name and ⊙ tier stay; no migration.
- Lifecycle phrase in `discovery-map.cjs` (`lifecyclePhrase`) and the
  render-time tag derivations (`derivations.cjs`,
  `conventions.cjs`) updated to the new vocabulary; the "claims a
  fan-out only when research completed" honesty rule becomes moot and
  simplifies away.

### 7. Provenance walk extended

`initialize-discussion.md` §B today walks only
`research-analysis:{parent}`. Extend it to the spawn source (§5) and
`reroute:{origin}` — read each parent/origin's completed research in
full at the child's discussion. Load-bearing under no-content-move:
the spawned thread's material lives in the parent's file. Degrades
gracefully — an origin with no completed research contributes nothing
to the walk. Existing `research-analysis:{parent}` values on live maps
stay recognised (rendering and walking) — provenance history is data,
not code to migrate.

### 8. Context-rich gates

Every gate this pass touches states its consequence in the menu copy —
what happens on each option, in words a non-author understands. Plus
one line in CONVENTIONS.md gate-authoring guidance so it binds future
gates. The fan-out offer is the cautionary tale: "keep on the map but
stop prompting to discuss it" read as a display preference and was
actually terminal.

## What deliberately does not change

- **Seeding asymmetry**: description + KB at child research,
  parent-in-full at child discussion. Discussion is the decision point
  and needs the full evidence base; child research has a narrow
  question and front-loading the whole parent biases it toward
  re-treading. Revisit only if a real walk shows starvation.
- **Gap-analysis** — untouched, sole boot-time analysis.
- **Two-tier reading**: read-in-full where declared, KB slices
  otherwise (`knowledge-usage.md` already authorises escalating to the
  full source file when a chunk is load-bearing). No new declared
  cross-research inputs for discussions — conversational + KB covers;
  the spec layer's consult-reference shape is the precedent if it ever
  needs formalising. Watch item.
- **Supersession semantics** — untouched, reserved for wholesale
  content replacement.
- **`engine discovery-map handle`/`unhandle`** — mechanics untouched;
  vocabulary only.

## Audit trail — checks run during design

- Parked concerns cannot be forgotten: a `triaged` stub keeps its
  topic `fresh`; convergence requires every map topic
  decided/cancelled/handled; `all_done` requires convergence settled
  (`epic-detail.cjs:381`). Engine-blocked.
- Two research files at one discussion: name-match + provenance walk
  (full read) and KB slices — exists, two-tier by design; the walk
  extension (§7) is what preserves it post-deletion.
- Research's review agent already declares the `route` lane; the
  shared surfacing already delivers route findings through
  `triage-landing`. The gap was new-name targets and the unowned-
  thread rule — two sentences, not machinery.
- Fumi's stuck session self-recovers: answering `n` at the open gate
  records the decline and the gate clears its spent state; even
  abandoned, the next boot counts zero pending candidates and clears.
  The migration sweeps strays elsewhere.

## Banked

- `ideas/discussion-split.md` — one discussion whose material needs to
  feed two different spec groups. Not built now; knowledge appended as
  the research side lands; keep or delete at the end.

## Test footprint

- Pipeline simulation: research-analysis calls removed; spawn
  permutation added; gate flow re-pinned.
- Prose cases: route-to-new-topic at research conclusion; user-invoked
  spawn; gap-analysis gate without the lead-in; dead-end offer.
- Migration suite for the staging sweep.
- Engine suites re-pinned where vocabulary changes renders
  (`test-engine-discovery-map.cjs`, `test-engine-discovery-projections.cjs`,
  `test-render.cjs`, `test-conventions-lint.cjs`).
- Goldens regenerated for relabelled renders.
