The prose should have taken this path:

1. initialisation runs the boot pipeline — no migrations to apply, the
   knowledge base ready — and the discovery dump shows no active work,
   a roadmap and two inbox items, routing to the empty state
2. the start snapshot renders with the roadmap's horizons and the start
   menu; the first scripted answer selects the inbox action by its
   ACTIONS entry
3. the inbox pickup snapshot lists the idea and the bug, and the second
   answer selects both numbers, building a two-item working set of
   mixed types
4. the working-set snapshot is fetched with both paths; each item gets a
   short synthesised summary in the set display; the menu offers the
   roadmap row beside work, and the third answer chooses it
5. the answer names no horizon, so the horizon step reads the roadmap's
   state and, finding horizons, renders the engine's pick over them
   (`mvp` then `v1`); the fourth answer's number resolves to `v1`
6. both notes are read in full, and one entry is composed per note, in
   set order: the idea named `scheduled-pickup`, the bug named
   `tip-charged-twice` — each name the note's filename without its date
   prefix — each with the horizon `v1`, a one-line summary in the
   product's terms, and its inbox path as `note`; no kind is written —
   the engine reads it from the note's folder. The entries are written
   once to the cache, and the confirm renders through the engine over
   that file, stating both items with the bug marked as a bug, and `v1`,
   flagging nothing new — the map already holds `v1`. The walk
   **STOPS** there
7. on the fifth answer one `roadmap add-batch` lands the same file. The
   verb commits itself: no commit call follows, nothing is archived,
   and no work unit is created
8. the user is told in one line that two items went onto the roadmap
   under `v1`; the working set is empty, so the flow returns to the
   inbox view, which now has nothing in it, and on to the start menu,
   which renders again and waits. The walk stops there

Further claims:

- the gate came before the landing: nothing moved while the confirm was
  on screen, and the one transaction ran only after the yes
- the roadmap was never opened as a skill: no roadmap session, no
  handoff anywhere in the walk

EXPECTED WORLD — the walk should have produced, from the fixture:

- the roadmap holds its two horizons, `mvp` then `v1`, and six items:
  the four fixture items untouched, and under `v1` two new waiting
  items —
  - `scheduled-pickup`: `kind: idea`, `origin:
    inbox:2026-01-01--scheduled-pickup`, its one source
    `.roadmap/notes/ideas/2026-01-01--scheduled-pickup.md`, and a
    summary about choosing a pickup time
  - `tip-charged-twice`: `kind: bug`, `origin:
    inbox:2026-01-01--tip-charged-twice`, its one source
    `.roadmap/notes/bugs/2026-01-01--tip-charged-twice.md`, and a
    summary about the tip charged twice
  - neither carries `pulled_to`
- both notes sit under `.workflows/.roadmap/notes/` at those paths,
  byte-identical to the fixture's inbox files; nothing is left under
  `.workflows/.inbox/ideas/` or `.workflows/.inbox/bugs/`, and nothing
  exists under `.workflows/.inbox/.archived/`
- no work unit, no new roadmap session log, no active-session marker
- the git history carries the engine's one roadmap commit over the
  project manifest and the moved notes, and nothing else new; nothing
  is left dirty
- the cache scratch the walk wrote is expected — the working-set
  summaries and the `.workflows/.cache/inbox-roadmap.json` entries are the
  surfaces' inputs, not state
