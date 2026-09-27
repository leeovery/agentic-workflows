The walk resumes a specification into its first construction gate,
where the user puts a capability on the roadmap without saying which
horizon. A map already exists, so the horizon is picked from what is
there rather than asked for in prose, and the park is sourced to the
specification the session is writing.

The prose should have taken this path:

1. the entry validates the completed source discussion and the
   in-progress specification item, and hands off to the processing
   skill
2. the specification file exists, so Step 0 offers the resume; the
   first scripted answer continues, which lands on session setup —
   verification and initialisation are the fresh path's steps and the
   file's existence means they already ran
3. session setup resets both gate modes to `gated` and finds no stale
   rows and no consult references; the principles are loaded and
   construction opens
4. the one source still reads `pending` and the specification holds
   only the body template, so extraction runs over the discussion and
   the first piece is presented in the shape it would take in the
   specification, followed by the engine-rendered construction gate.
   The walk **STOPS**
5. the second scripted answer does not answer the gate — it puts a
   capability aside. The processing skill's standing `## Backlogging`
   section routes to backlogging.md with work_unit `pay`, topic `pay`,
   phase `specification`; the pending gate is left to re-present on
   return
6. **A. Which Backlog** reads the user's own words: they place the
   idea on the roadmap but name no horizon. The home is settled, so
   the ambiguity gate is never written and never rendered — the
   horizon is what is open
7. **B. The Horizon** reads the roadmap state. `horizons` is
   non-empty, so the horizon is picked rather than asked for: the pick
   renders the map's horizons in their order as numbered rows, each
   with what waits in it, and `n/new` beneath them. The walk
   **STOPS**. Nothing in prose asks the user to name a horizon — that
   arm belongs to a map that does not exist
8. the third scripted answer is a number, and it resolves to the
   second horizon — `v2`
9. **C. Park** derives a kebab-case name and a one-line summary at
   capability grain — an operator refunding a paid order, not this
   specification's mechanics — and takes the source from the phase
   table: specification points at the specification, so the source is
   `pay/specification/pay/specification.md`
10. the confirm renders through the engine carrying the name, `v2`,
    the summary and that source. The map already holds `v2`, so the
    horizon carries no `(new)` flag and the statement says nothing
    about the roadmap being created — it exists. The walk **STOPS**
11. on the fourth scripted answer the park is one engine call:
    `roadmap add {name} --horizon "v2" --summary "…" --origin park:pay
    --source pay/specification/pay/specification.md`. The verb
    validates, adds the item under the existing horizon, and commits
    the project manifest itself — no commit call follows it, no
    horizon is created, and the roadmap skill is never invoked
12. the specification keeps no running record of parks — the item's
    own origin and source are its provenance — so nothing is written
    into the specification or its Working Notes; the user is told in
    one line what was parked and where
13. control returns to the caller. The interrupted flow is
    construction at its approval gate, which the aside set aside: the
    session asks in conversation — no gate, no menu — whether the user
    is ready to move on, and the walk never falls through to the
    skill's Step 0. The walk STOPS
14. the fifth scripted answer says they are ready — never the gate's
    answer — so that gate comes back, fetched from the engine. It stops there: the gate
    unanswered, nothing logged to the specification, the source still
    `pending`

The end world's claims:

- the roadmap holds the same two horizons it started with, `v1` then
  `v2`, in that order. No third horizon was created
- one new item sits under `v2`: a kebab-case capability name for the
  operator refund, `origin: park:pay`, a summary that reads as the
  capability rather than as this session's business, and
  `pay/specification/pay/specification.md` as its one source. It
  carries no `pulled_to` — it is waiting, joined to nothing
- the two fixture items are untouched: `wallet-payments` still under
  `v1` and `subscription-billing` still under `v2`, both with their
  original summaries and `origin: harvest`
- the specification document is byte-identical to the fixture's: the
  body template alone, no extracted content, no note of the park. The
  gate was never answered, so nothing was logged
- the specification item still reads `in-progress` with
  `sources.pay.status` `pending`, `review_cycle` 0, and both gate
  modes `gated` — session setup re-set them to the values they already
  held. No date change, no tracking subtree
- the discussion document and item are untouched, and no file exists
  anywhere under `.workflows/.inbox/`: the words placed the idea, so
  the inbox was never the question
- the git history carries the engine's own roadmap commit over the
  project manifest, and nothing else new. Nothing is left dirty
  outside the cache
- the five scripted answers were consumed by the resume choice, the
  aside, the horizon pick, the park confirm, and the readiness
  question, in that order. The
  user was never asked which backlog and never asked to name a horizon
