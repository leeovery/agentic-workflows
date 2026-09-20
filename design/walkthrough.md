# Walkthrough — teach the system once, then answer anywhere

The workflows are taught nowhere inside the product. The book lives in
`docs/`, outside the install; every on-screen surface either
over-explains at the moment of action or leaves the person to meet a
word cold; and a session asked "what does this mean?" has no
trustworthy source to answer from. The walkthrough is the fix in three
parts: a short first-run walk that teaches the mental model once and is
re-runnable forever under `h/help`; a canonical glossary every screen,
card and answer is written from; and one shared rule that lets any
session answer a question about how the system works and put the menu
back. Design log for the stack. Opened 2026-09-20 from the discussion
with Lee.

## Motivation (2026-09-20)

- **There is no in-product teaching, and the vocabulary is met cold.**
  A newcomer running `/workflow-start` on a fresh project meets
  *knowledge base*, *phase*, *work unit*, *topic*, *pipeline*,
  *baseline*, *roadmap* and a dozen more before the start menu appears,
  none defined on screen. The empty start menu's pipeline-shaped labels
  are the only place the pipelines are ever taught. The 23-page book
  under `docs/` is complete and never on the person's disk.

- **Plain labels moved the teaching somewhere that did not exist.**
  #1222 trimmed the roadmap's menus and banners to plain verbs — right,
  because a label is read at the moment of action, often by someone who
  skipped every explanation. That ruling assumed a walkthrough would
  carry the vocabulary. This is it.

- **The evidence is specific about the shape.** Upfront tutorials
  measured by NN/g produced no better task success and made the product
  feel harder; the one large study of tutorials (Andersen et al., CHI
  2012, 45k players) found they paid off only in the most complex
  system tested. Completion collapses with length. Every real terminal
  tutorial (`vimtutor`, Emacs, `:Tutor`) is re-runnable; "show once"
  lives in the offer, never the tutorial. Working memory carries about
  four chunks (Cowan), not seven. So: offered not forced, one key to
  skip, eight short screens with four ideas each, and the one thing a
  static tutorial cannot do — branch on a question and come back — is
  where the design spends its budget.

- **The door for questions already exists.** Every menu in the system
  takes plain language. What is missing is a source to answer from and
  the sanction to do it: today a session either improvises from general
  knowledge or stays terse and pushes on. Per-surface help rows and
  first-encounter tips are the coach-marks pattern people dismiss on
  sight, and would touch every projection for little gain.

## The decision

1. **One skill, `workflow-help`, model-only, project-level, outside the
   pipeline.** It owns the help home, the reference cards, the glossary,
   and the walk. It is reached two ways: workflow-start's first-run
   offer, and the `h/help` row on both start menus. It holds no work
   unit, no phases, and no session label.

2. **The walk is a loaded reference, not a terminal skill.** Baseline
   and roadmap are destinations; the walk is a detour that returns.
   `workflow-help/references/walk.md` is loaded across the skill
   boundary by workflow-start's Step 0.2 (the same pattern as the
   bridge loading the epic dashboard and the roadmap's back loading
   `start-menu.md`) and by the help skill's own `w/walk`. When the walk
   ends, control returns to whichever caller loaded it.

3. **Eight fixed screens, engine-rendered.** The curriculum follows the
   arc of a project on the workflows, not a taxonomy:
   1. *The idea* — process plus memory; thinking written down before
      building; the decisions are yours, the record and the work are the
      system's.
   2. *Where everything starts* — the one door; press `s` and talk; the
      rhythm of a session (it works, it stops at a decision that is
      yours, you answer with a key or plain words or leave; everything
      is in git).
   3. *Your first conversation* — describe what's on your mind; the
      system works out the shape (the whole product, or one piece of
      work and which kind); "Have I read this right?"; nothing on disk
      until yes.
   4. *The product takes shape* — the roadmap: items in horizons you
      name; "lay it out"; a park mid-conversation; starting work on
      items births an epic or a feature fenced to them.
   5. *An epic and its topics* — the design conversation; topics drawn
      out at the harvest, each with a brief; the dashboard's three bands
      and the topics moving down through them.
   6. *The journey of one piece of work* — the phases stage by stage,
      what each writes, what you do; the bugfix, quick-fix and
      cross-cutting variations.
   7. *How much of you it needs* — the cone: you lead early, approve in
      the middle, step back at delivery; gates never answered for you;
      `auto` for a sitting; the gates that never yield.
   8. *Living with it* — features, bugs and fixes through the same door;
      capture into the inbox mid-flow; reshaping (pivot, absorb, cancel,
      reopen, input moved); where help lives.

   Setup is never taught. The label question, the knowledge gate and the
   baseline offer self-explain at the moment they happen and are
   one-time; the walk is about the workflows as a product, the way a
   product tour never explains logging in. Baseline and the memory's
   configuration appear only as reference cards.

4. **Screen 1 is the offer.** On a first run the first screen carries
   the pitch paragraph and two keys: `n/next` records `walked`, `s/skip`
   records `skipped`. The recorded status drives the offer alone —
   nothing else reads it, and the `h/help` row is unconditional. It
   shows once per project; an existing project meets it once on the
   upgrade that ships it; prose-test worlds stamp `skipped` so no
   unrelated case ever meets it. There is no "don't show again": the
   offer is answered once and the answer is the record.

5. **Placement is Step 0.2, straight after boot.** Boot → walkthrough →
   session labels → knowledge gate → baseline judgment → the menu. The
   first thing a new user sees after the banner is what this is; the
   setup gates follow and explain themselves. The existing sub-steps
   renumber (0.3, 0.4, 0.5) and the knowledge gate's two return routes
   name the new number.

6. **Questions branch and return.** At any screen, free text is a
   question. The session answers it under decision 7's rule, then puts
   the same screen's menu back with `--menu-only` — never the whole
   screen again. If the question is about a later screen, the answer is
   short and names the screen. Screen 8 carries a closing prompt —
   "tell me what you're likely to start with" — answered by naming the
   path that work will take, in the product's terms, then the menu
   again. It is the one moment the walk touches the person's own
   project, and it hands straight into the real first conversation.

7. **Every session may answer "how does this work".** A shared
   reference loaded from `framework.md` sanctions and bounds it. When
   the person asks about the system rather than about the work, the
   session loads the glossary (lazily — only when a question arrives),
   answers in a few ordinary sentences at product altitude, never in
   engine verbs, file paths or skill names, says plainly when the
   glossary does not cover it and points at the docs rather than
   inventing an answer, offers the relevant reference card when more
   than a short answer is wanted, and then puts the menu back by
   re-running the call that produced it. The walk's own question loop
   is this rule with `--menu-only`. Every prose surface in the system
   gets help from one file; no menu gains a row for it.

8. **The glossary is the canonical vocabulary.**
   `workflow-help/references/glossary.md` holds one word per concept,
   chosen deliberately, with the aliases to avoid listed beneath it,
   definitions of one or two sentences that use the glossary's own
   terms, and ambiguities resolved in place ("in this system, *topic*
   always means…"). The screens, the cards and every answer adhere to
   it. The words taught are the words the person will see on screen;
   where the docs use another word, the glossary names it once as the
   alias. This settles which words get taught: each is decided once,
   and the menus, the walk, the cards and the docs converge on it.

9. **Help home and reference cards.** `h/help` opens a home with
   `w/walk` (the eight screens), `t/topics` (the cards), a prompt row
   for a question, and `b/back`, which re-renders the start menu through
   `workflow-start/references/start-menu.md`. The cards are written as
   reference, not lesson — what the word means, where you will see it,
   what to do about it — because the walk is read once and the cards are
   returned to. Nine cards: the kinds of work; the phases; epics, the
   map and the dashboard; the roadmap; stops, gates and `auto`; the
   memory and the baseline; the inbox; reshaping work; working in
   parallel. A card can be rendered from inside any session when a
   question wants more than a short answer.

10. **Register.** Screen and card prose is written the way a person
    explains something — ordinary sentences, no staccato, no "x does y"
    cadence, never paraphrased from the codebase's own terms. Prose
    sections emit as markdown so they wrap to the pane; diagrams and
    example surfaces emit as code blocks. Every diagram fits 65 columns,
    reads top to bottom, and is drawn from the system's own visual
    grammar — the dashboard's `── STAGE ──` dividers, the tree glyphs,
    the lifecycle glyphs, arrows, and shaded bars for the cone — never
    walls (D8 holds). The screens teach the shapes the person will meet
    on the real surfaces.

11. **State is one node, two values.** `project.walkthrough.status` is
    `walked` or `skipped`; boot reports `walkthrough` as `none`,
    `walked` or `skipped`; `engine walkthrough record <walked|skipped>`
    writes and commits it confined, refuses any other value, and refuses
    a second record. Nothing else is stored: no seen-set, no screen
    position, no system-level memory of having walked elsewhere.

12. **The docs stay the explanation.** The walk is the tutorial, the
    cards are the reference, `docs/` is the full account. The closing
    card points at the book. `docs/introduction.md` gains a sentence
    about the offer; CLAUDE.md gains the Help skill paragraph and the
    new Step 0 order.

## Engine surface (small, mechanical)

- `domain/walkthrough.cjs` — the one state home: `walkthroughState(cwd)`
  → `{status: 'none'|'walked'|'skipped'}`; `recordWalkthrough(cwd,
  answer)` mirroring `recordBaselineVerdict` (project lock, atomic
  write, `commitPathspecScoped` on the project manifest, refusals as
  errors).
- `boot` — `walkthrough: walkthroughState(cwd).status` on the result and
  the `BootResult` typedef.
- `engine walkthrough record <walked|skipped>` — usage line, `runWalkthrough`
  beside `runBaseline`, one-line JSON response.
- Render surfaces (`projections/walkthrough.cjs`, registered in
  `render.cjs`):
  - `walkthrough-screen --screen <1..8> --from <first-run|help>
    [--menu-only]` — TITLE (`■ How the workflows work · N of 8 · Title`),
    DISPLAY sections alternating markdown prose and code-block
    diagrams as the content file's fences dictate, MENU. Menu rows by
    position and origin: screen 1 first-run carries `n/next` (labelled
    with the next screen's title) and `s/skip`; screens 2–7 carry
    `n/next`, `b/back`, and `s/skip` (first-run: "Stop here — it's under
    h/help whenever you want it") or `s/stop` (help: "Stop here and go
    back to help"); screen 8 carries `d/done` ("Go to the start menu" /
    "Back to help") and the closing prompt row. Every screen carries the
    prompt row "Or ask a question about anything on this screen".
    `--menu-only` emits the MENU alone.
  - `walkthrough-home` — TITLE `■ Help`, MENU (`w/walk`, `t/topics`,
    prompt row, `b/back`).
  - `walkthrough-topics` — MENU of the nine cards, numbered, plus
    `b/back`.
  - `walkthrough-topic --name <slug>` — TITLE, DISPLAY sections, MENU
    (`t/topics`, `b/back`, prompt row).
- Content files beside the projection: one markdown file per screen and
  per card, first line the `# Title`, fences marking the code-block
  sections. The projection splits on fences. A test invariant pins every
  fenced line at 65 columns or under across every content file, and
  the D8 box-glyph invariant already covers them.
- `projections/start.cjs` — an `h/help` row (`open_help`, route
  `/workflow-help`, label "How the workflows work") on both the empty
  and the populated menu, unconditional.
- Tests: goldens for every screen and card at the pinned width; the
  width invariant; the boot field; the record verb's contract
  (accepts, refuses values, refuses a second record, commits confined);
  a pipeline-simulation permutation for the verb; the start-menu
  goldens.

## Skill surface

- `skills/workflow-help/` — `SKILL.md` (model-only; Step 0 reads its
  argument: `first-run` is never passed — the walk reaches first-run
  through the reference — so the skill's own entry is the home);
  `references/walk.md` (the screen loop: render, stop, act on the key,
  route a question through the shared rule, `--menu-only`, and on
  screen 1 under first-run the `record` call before screen 2 or before
  returning); `references/home.md`, `references/topics.md`;
  `references/glossary.md`.
- `skills/workflow-start/SKILL.md` — Step 0.2 Walkthrough: when boot
  reports `walkthrough: none`, load `walk.md` with origin first-run;
  otherwise fall through. Steps 0.3–0.5 renumbered;
  `references/knowledge-gate.md` returns to Step 0.5.
  `references/empty-state.md` and `references/active-work.md` route
  `open_help` → invoke `/workflow-help`.
- `skills/workflow-shared/references/` — the answering rule (decision
  7), loaded by `framework.md` after `ask-or-decide.md`.
- Prose tests: `workflow-help` joins the entry allowlist in
  `tests/prose/lib/cases.cjs`; worlds stamp `walkthrough.status:
  skipped` and strip it on snapshot as `tmux_labels` is; cases for the
  first-run skip, a first-run walk of two screens with a question and a
  stop, and the help home reached from the start menu into a card and
  back.

## Build log (2026-09-20)

Stack shape: this design as a standalone PR; then three implementation
layers — engine (state, verb, boot field, surfaces, the eight screens'
content, tests); the reference cards and the topics surface; the skill,
the shared answering rule, the workflow-start hooks, the prose cases,
the docs and CLAUDE.md.

## Open / deferred

- **Sample-world renders through the real projections.** Screens 4 and
  5 could render the actual start menu and epic dashboard from a fixture
  manifest so the lesson can never drift from the surface. Hand-drawn
  diagrams ship first.
- **First-encounter offers** (a once-only "want a two-minute read of
  this screen?" the first time a dashboard renders) — rejected for now;
  the answering rule covers the need.
- **A fast lane** on screen 1 for people who know spec-driven workflows —
  dropped; skip is already one key.
- **System-level memory** of having walked in another project — not
  now; the per-project offer costs one keystroke.
- **Cards generated from the glossary** rather than authored beside it —
  later, once both exist and the drift is real.
