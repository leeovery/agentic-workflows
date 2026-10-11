The prose should have taken this path:

1. initialisation runs the boot pipeline — no migrations to apply, the
   knowledge base ready — and the discovery dump shows no active work,
   a roadmap and one inbox item, routing to the empty state
2. the start snapshot renders with the roadmap's horizons and the start
   menu; the first scripted answer selects the inbox action
3. the inbox pickup snapshot lists the one bug, and the second answer
   selects it, building a one-item working set
4. the working-set snapshot is fetched with its path and a short
   synthesised summary; the third answer chooses the roadmap row and
   names `v1` in the same breath, so the horizon is taken from the
   answer: no roadmap state is read and no horizon pick renders
5. the note is read in full, and one entry is composed: the name is the
   note's filename without its date prefix — `receipts` — with the
   horizon `v1`, a one-line summary in the product's terms, and its
   inbox path as `note`. The entries are written to
   `.workflows/.cache/inbox-roadmap.json`
6. the confirm is rendered through the engine over that file, and the
   engine refuses it: `receipts` is already on the roadmap. Nothing has
   moved and nothing is shown for a yes
7. the refusal is met by its own branch: a more specific name is derived
   from the note — something about the receipt total leaving the tip
   out — never a numeric suffix and never the old name with a digit,
   and the file is rewritten with it; the existing `receipts` item is
   never renamed, edited or removed to make room
8. the confirm renders again over the rewritten file, stating the item
   marked as a bug under `v1`, and the walk **STOPS**
9. on the fourth answer one `roadmap add-batch` lands the same file. The
   verb commits itself: no commit call follows, nothing is archived,
   and no work unit is created
10. the user is told in one line that one item went onto the roadmap
    under `v1`; the working set is empty, so the flow returns to the
    inbox view, which is read again from the engine and now has nothing
    in it, and on to the start menu, which renders again and waits. The
    walk stops there

Further claims:

- the refusal came from the confirm, before any landing: the only
  `roadmap add-batch` ran after the second confirm and the yes
- the user was never asked to choose a name: the refusal is settled by
  deriving one, and the name only reaches them in the second confirm
- the roadmap was never opened as a skill: no roadmap session, no
  handoff anywhere in the walk

EXPECTED WORLD — the walk should have produced, from the fixture:

- the roadmap holds its two horizons, `mvp` then `v1`, and six items:
  the five fixture items untouched — `receipts` among them, still an
  idea under `v1` with its own summary — and under `v1` one new waiting
  item, kebab-case, more specific than `receipts` and not `receipts`
  with a number on it, with `kind: bug`, `origin:
  inbox:2026-01-01--receipts`, its one source
  `.roadmap/notes/bugs/2026-01-01--receipts.md`, a summary about the
  receipt total leaving out the tip, and no `pulled_to`
- the note sits at `.workflows/.roadmap/notes/bugs/2026-01-01--receipts.md`,
  byte-identical to the fixture's inbox file; nothing is left under
  `.workflows/.inbox/bugs/`, and nothing exists under
  `.workflows/.inbox/.archived/`
- no work unit, no new roadmap session log, no active-session marker
- the git history carries the engine's one roadmap commit over the
  project manifest and the moved note, and nothing else new; nothing is
  left dirty
- the cache scratch the walk wrote is expected — the working-set
  summaries and `.workflows/.cache/inbox-roadmap.json` are the
  surfaces' inputs, not state
