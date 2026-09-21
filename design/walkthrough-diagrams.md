# Walkthrough diagrams — drawn by the engine, from the system's own surfaces

The walkthrough's eight screens shipped with hand-drawn diagrams inside
fixed fences: sentences typeset as a flowchart, indented by hand to fake
a centring that only held at 65 columns, arrows placed under whatever
the author's eye landed on, and a first screen whose picture described
talking to Claude Code rather than what the workflows do. This design
replaces every diagram with one the engine lays out at the pane's width
from a small notation in the content file, or renders through the same
projection that draws the live surface it depicts, and rewrites the
prose of every screen to the register the reader is owed: an engineer
being shown how a system works, given the reasons, never taught down to.
Opened 2026-09-21 from a screen-by-screen review with Lee. Amends the
concluded [walkthrough design](walkthrough.md) by its own record, as a
concluded design is never edited.

## Motivation (2026-09-21)

- **The fences could not re-flow, so every diagram was a bet on one
  width.** A fenced line renders as drawn; the 65-column invariant
  guarded overflow on the narrowest pane and guaranteed nothing about
  the widest, where a hand-centred block sat at an arbitrary left
  offset. The engine already knows the pane's width (`kernel/terminal`)
  and already wraps to it everywhere else (`kernel/render`); the
  walkthrough alone drew by hand.
- **The shapes were wrong for their content.** A vertical column of
  lowercase fragments joined by arrows was used for a process, a place,
  a decision and a list alike. Read cold it is neither a sentence nor a
  list. Only one screen's content is a strict sequence.
- **Three screens imitate a real surface** — the start menu, the
  roadmap, the epic dashboard — and imitation drifts. The walkthrough
  design deferred rendering them through the real projections; this is
  where that lands.
- **The register slipped.** "You and Claude talk it through" frames the
  engineer as a chat participant; "there is only one thing you need to
  remember" is a tutorial hook with no content; "you don't decide what
  kind of work it is" was untrue of a menu that offers `f`, `e`, `b`,
  `q` and `c`. The walk is explanation (Diátaxis): it exists to give
  the reasons things are the way they are, in the reader's second
  person, with no figurative language and nothing declared easy.

## The decision

1. **Every diagram is laid out by the engine at the detected width,
   left-anchored on the gutter.** No diagram is centred: the tree
   glyphs and the arrow spine only line up when everything hangs off
   one column. Node text wraps under itself; a table's last column
   wraps under itself and a table that cannot fit its columns falls
   back to one block per row; bars scale to the space between the label
   column and the note column. The 65-column invariant is retired for
   laid-out diagrams and replaced by rendering every screen at the
   kernel's floor, fallback and cap widths with no line overflowing.

2. **The content file declares a diagram's kind on its fence.** A fence
   with no language stays verbatim, as the reference cards' diagrams
   are today (their invariant stays). Four tagged kinds:
   - `flow` — one element per line: a node, `↓` for an arrow on the
     spine, an indented `→ ` detail line beneath the node above. A node
     may be `label | text`, and labels align to one column across the
     flow. The one strict sequence in the walk (screen 1) is the only
     flow.
   - `table` — rows of ` | `-separated cells; a leading `── NAME` line
     is a band divider filled to the width, drawn as the dashboard
     draws its stages; a row whose first cell is empty is the header.
     Column widths are the longest cell per column; the last column
     takes the rest. Rows indent three under a plain table and two
     beneath band dividers, matching the dashboard.
   - `bars` — rows of `label | share | note`, the share a fraction of
     the bar budget.
   - `sample <surface>` — the named live surface rendered from a
     fixture through its own projection: `start-menu`, `roadmap`,
     `epic-dashboard`. Menu rows render as plain text (the markdown
     stripped) because the sample is an illustration inside a code
     block, never a live menu. Key and legend blocks are omitted. The
     fixture is a manifest the projection's own derivation reads, so
     the picture is produced by the code that draws the real thing and
     cannot drift from it.

3. **Each screen's diagram takes the shape its content has.** Screen 1
   a flow (the three stages, each naming its phases and the document
   it yields, with the engineer's decision visible at each). Screen 2
   the start menu with work in flight. Screen 3 a table of the five
   kinds against the three stages. Screen 4 the roadmap after items
   have been started. Screen 5 the epic dashboard with topics in every
   band. Screen 6 a banded table of each phase against what it leaves
   behind. Screen 7 the bar chart. Screen 8 a two-column reference of
   everyday situations against what to do.

4. **The prose is explanation.** Every screen opens on what the thing
   is and gives the reason it is that way; the second person throughout;
   the glossary's words and none coined; no figurative language, no
   "talk", no claim the surface does not bear out. Screen 1 opens as a
   guide to itself: eight screens, five minutes, leave when you like,
   waiting under help on the start menu. Screen 3 is retitled "What the
   work is" — it is about discovery settling the kind, not about a
   conversation. The approved text of every screen is the content in
   `skills/workflow-engine/content/walkthrough/screens/`.

5. **`h/help` sits at the bottom of the start menu**, beneath
   `m/manage`, on the empty and the populated menu alike. Unrelated to
   the walk, asked for in the same review, its own PR; the screen 2
   sample shows that order because it is rendered from the real
   projection.

6. **The screen 5 fixture names a plan format.** A real planning row
   carries the plan's format in its tag and the fixture behind the
   sample has to name one. CLAUDE.md forbids naming a format outside the
   format files; that fixture is the recorded exception, because the
   whole point of the sample is the real surface.

## Engine surface

- `projections/walkthrough.cjs` — the fence parser reads the language
  tag; `chunkSections` hands a tagged chunk to the layout for its kind
  and emits the result under the existing `DISPLAY: walkthrough
  diagram` marker, so `walk.md`'s emission rules do not change.
- The layouts live beside the projection as pure functions over
  `(source, width)`, built on `kernel/render`'s `wrap`; nothing in them
  knows a screen.
- Sample fixtures live under `content/walkthrough/fixtures/`, one per
  surface, and are rendered through the start, roadmap and epic
  projections' own derivations.
- Tests: goldens for every screen at the pinned width; every screen
  rendered at `MIN`, `FALLBACK` and `CAP` with no line over the width;
  the layouts' own contracts (wrap, fallback, band fill, bar scaling,
  label alignment); the verbatim path and its invariant for untagged
  fences; the start menu's row order.

## Open / deferred

- **The reference cards** keep their hand-drawn fences. Converting them
  to the notation is the same work again, screen by screen, and waits
  for the same review.
- **Screens 4 and 5 could render from the roadmap and epic
  projections' menus too**, showing the recommendation beneath the
  display. The display alone is the lesson for now.
