The prose should have taken this path:

1. the roadmap skill opens in its open mode
2. the roadmap home renders from its snapshot, `mvp` showing ordering
   in delivery beside its two waiting items; the first answer resolves
   to the converse action through the home's ACTIONS entry
3. a fresh product session opens on the map — no session was left
   open, so nothing is resumed — and the user asks for the gift-cards
   idea in their inbox to be brought onto `mvp`: grooming an inbox item
   on, not exploration and not a direct add
4. the note is found at its live inbox path,
   `.workflows/.inbox/ideas/2026-01-01--gift-cards.md`, and read. It is
   an idea, so the add gate is fetched over `mvp` before anything lands;
   a member of `mvp` is in delivery, so the gate renders its menu — its
   DATA naming `launch` — and the walk **STOPS**
5. the third answer picks waiting, so the idea lands in `mvp` the way
   it came — as a groomed idea. The grooming is this session's first
   state change, so the log is conjured before it runs: `roadmap session
   open` allocates `session-002`. The entry is written to
   `.workflows/.cache/roadmap/inbox-items.json` — name `gift-cards`
   (the note's slug; the user named none), horizon `mvp`, a one-line
   summary in product terms, and the note's inbox path as `note` — and
   `roadmap add-batch` lands it, moving the note into the roadmap's
   notes and deriving the item's kind, origin and source from it
6. no plain `roadmap add` runs for the idea, before or after the
   batch, and nothing is pulled forward into `launch`
7. the grooming is recorded under the log's Edits as a `Groomed:` entry
   naming the idea, its kind and `mvp`, and committed with
   `commit --roadmap`
8. the loop turns back to the conversation and the walk stops there

Further claims:

- the gate was answered by the pick, and nothing landed while it was on
  screen
- the session is not laid out, harvested, or closed

EXPECTED WORLD — the walk should have produced, from the fixture:

- a new roadmap item `gift-cards` in `mvp`, waiting — no `pulled_to`
  join — with `kind: idea`, `origin: inbox:2026-01-01--gift-cards`, its
  one source `.roadmap/notes/ideas/2026-01-01--gift-cards.md`, and a
  one-line summary about selling and redeeming gift cards on the
  storefront
- the note at `.workflows/.roadmap/notes/ideas/2026-01-01--gift-cards.md`,
  byte-identical to the fixture's inbox file; nothing left under
  `.workflows/.inbox/ideas/`, and nothing under
  `.workflows/.inbox/.archived/`
- `ordering` still joined to `launch`; `menu-management`,
  `kitchen-display` and `loyalty` unchanged
- a second roadmap session log (`session-002.md`) under
  `.workflows/.roadmap/sessions/`, still open (the active-session marker
  naming it) and committed, whose Edits record the grooming of
  `gift-cards` into `mvp`; session 001 untouched
- the `launch` epic untouched: no discovery map items, no topics, no
  research or discussion files
- the cache scratch the walk wrote is expected — the session draft and
  `.workflows/.cache/roadmap/inbox-items.json` are inputs, not state
