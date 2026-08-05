# Adaptive Display — the display sizes itself, and styling comes from the renderer

Every width in the display is a constant chosen once for a terminal
nobody measured. Trees wrap at 65 in a 106-column pane, phase titles
draw a 49-character box, signposts are hand-wrapped to ~70 by an author
counting characters. This programme makes the content size itself to
the terminal, and replaces every hand-drawn frame with styling the
renderer already provides — so the display is correct at 58 columns and
at 120, and no author ever counts a character again. Design log for the
stack. Opened 2026-08-04.

## Motivation (2026-08-04)

The banked entry read *"dashboards wrap at ~55 chars in a 200-char
terminal; current width is designed for mobile"*, and proposed a
`display.width` setting resolved down the existing cascade. Two things
were wrong with that framing, and both were found by measuring rather
than reasoning.

**The width is detectable.** The naive probes all fail — our stdout is
a socket (`isTTY` undefined), `COLUMNS` is exported as `0`, `/dev/tty`
is not configured, and `tput cols` answers `80` from terminfo without
consulting anything. But `CLAUDE_PID` is in the environment, and the
tty that process is attached to knows its own size:

    stty size < /dev/$(ps -o tty= -p $CLAUDE_PID)   →  43 108

Verified live: a mid-session resize from 108 to 58 columns was picked
up with no restart and no re-attach, driven from a remote Blink client
over SSH while every attached tmux client still reported 109. So the
read tracks the pane actually being looked at, and a stored setting is
the wrong mechanism — it would have been wrong twice in one hour.

**The chrome cannot follow.** Static chrome is literal in skill prose
by rule (`commands.md` §220), so a width that only the engine knows
would widen trees and leave 107 hand-drawn frames frozen at 49. That
made the chrome question the dominant one, not a footnote — and its
answer turned out to be that the frames should not exist at all.

## What the renderer actually does

Every claim here was measured in Claude Code 2.1.220, not assumed.
Several contradict conventions written when the renderer was younger.

**Layout**

- Usable width is `pane − 2`: a 108-column pane renders 106 columns of
  content behind a 2-column gutter. Identical for prose and for fenced
  code blocks.
- Overflow **soft-wraps**, it does not truncate. Nothing is ever
  hidden; an over-wide tree orphans its `│` gutter onto the next line.
  Under-estimating is therefore safe and over-estimating is ugly —
  the resolved width wants a column or two of headroom.
- Runs of multiple spaces are preserved, so columns can be aligned
  without tables.
- Markdown lists do **not** hang-indent on wrap. A wrapped list item's
  continuation returns to the left margin, where a new item would
  start. (Observed in real session output, not in a mock.)

**Inline styling**

| Form | Renders as |
|---|---|
| `#` heading / setext `===` | white, italic, **underlined** |
| `##`, `###`, setext `---` | plain body text |
| Inline code (backticks) | light blue, no background block |
| Link | dark blue, syntax hidden, *not* underlined |
| Bold | white / bright |
| Italic | italic |
| Strikethrough | not rendered |
| `---` on its own line | literal three hyphens — **no horizontal rule** |
| `<hr>` | literal |

H1 is the only heading level with any styling, so markdown offers
exactly one level of hierarchy. Everything else must come from colour.

**Fence colouring**

Fences show no language label. Syntax highlighting is live (theme:
Nord), and the trap is that most languages tokenise ordinary English:

- `python` — colours `from`, `and`, `in`, `is`, `not`
- `ruby`, `elixir`, `haskell` — colour capitalised words, so prose
  speckles wherever a sentence starts
- `yaml` bare scalar — whole line red, **but** `no`, `yes`, `on`,
  `off`, `true`, `false` are booleans and colour separately
- `dockerfile`, `bash` — close, but `from` still colours

Two are safe for arbitrary text:

- **`makefile`** — white body, green `#` comments, no English
  tokenisation at all
- **`properties`** — first token turquoise, everything after the first
  space red and untokenised, punctuation-safe

Also useful, within a controlled vocabulary: `yaml` comments (green)
and `yaml` keys (teal).

**Blockquotes**

The border renders as `▎`, and it now survives wrapping — including a
second and third continuation — with bold carrying across intact. The
`~70 character` hand-wrap rule and the `no bold in signposts` rule both
existed to work around a renderer limitation that is gone.

## The width contract

Resolution order, read at render time on every call:

1. explicit override (env) — pinned by the prose harness, used headless
2. `CLAUDE_PID` → `ps -o tty=` → `stty size`
3. process-tree walk to the nearest tty
4. tmux (`TMUX_PANE` → `pane_width`)
5. fixed default — today's behaviour, so the worst case is no change

Then `usable = min(detected − 2 − headroom, 120)`.

The **120 cap** is legibility, not capability: line length stops being
comfortable somewhere around 90–110 characters, and an unbounded tree on
a maximised 200-column display is worse than a capped one.

The **override is mandatory, not optional** — without it every prose
snapshot becomes machine-dependent.

## The register grammar

Four signals, spent deliberately so each keeps meaning:

- **light blue** (inline code) — structure
- **dark blue** (link) — unspent, reserved
- **green** (makefile comment) — status, within a closed vocabulary
- **red** (properties value) — blocked; you cannot proceed

There is a **fourth chrome category** the first pass missed: chrome the
engine draws *inside* a fence. The epic dashboard's stage dividers
(`── DISCOVERY ──`) are `signpost()` calls emitted into the DISPLAY
block, where markdown cannot reach — so neither the prose sweep nor the
width slice covers them. They size to the content they divide, which is
free because they are engine-drawn, and unlike a menu rule they span
exactly the block they belong to rather than the whole terminal.

Glyphs carry the second axis, because colour dies if highlighting is
off or the theme changes:

- **circles are state** — `○ ◐ ✓ ⊙ ⊘`, the existing status vocabulary
- **squares are structure** — `■ □ ▪`, the chrome ranks
- **`◆` is a decision** — menus
- **`⚑` is an alert** — and in the `properties` register it is also the
  token that makes the rest of the line colour uniformly

`●` is retired from chrome: Claude Code draws `⏺` in its own gutter,
and circles already mean state, so a filled circle was the third
meaning of one shape in a single field of view. Left-rail glyphs
(`▌ ▍ ▎ ▏`) are avoided — `▎` is the blockquote border.

## Chrome

Three drawn frames become three markdown lines. 107 literal instances
across 33 files, all width-free by construction, none costing an engine
call.

| Element | Before | After |
|---|---|---|
| Phase title | `●───…───●` box, 3 lines, 49 wide | `# ` + bold inline code + `■` |
| Step marker | `── Name ────…` padded to 49 | bold inline code + `□` |
| Sub-step | `·· Name ····…` padded to 49 | bold inline code + `▪` |

The phase title loses two lines of vertical mass and gains colour plus
an underline — visual intensity traded for hue, judged a fair swap on
inspection of real output.

## Trees

Rendered in a `makefile` fence: white body, green status, safe against
any user-authored topic name.

`[discussing]` becomes a right-aligned `# discussing` column, computed
from the longest title so statuses line up regardless of label length.

Layout gains a **connector** — an unbroken vertical from the parent's
glyph down to its last child, with body text hanging off it — and a
**hanging indent**, so a wrapped body line sits under the text it
continues rather than under the `↳`. A node with a body but no children
has nothing to connect to, so its body falls back to the unconnected
form; that is a real branch in the layout code, not a constant.

    ├─ ◐ Payment Retry Semantics    # discussing
    │  │  ↳ Derived from research: idempotency keys must survive a
    │  │    gateway timeout, so the retry window and the key TTL are
    │  │    the same decision.
    │  ├─ ✓ Key Lifetime            # decided
    │  └─ ○ Backoff Schedule        # pending
    └─ → Webhook Reconciliation     # ready

`↳` survives: it marks provenance (`epic.cjs` `source_provenance`),
which a plain summary body does not carry. Without it the two collapse
into one undifferentiated block.

## Menus

Menus are markdown, not code blocks — their keys are already bold
inline code, already light blue, already reflowing. The redesign is
therefore layout, not colour:

- `◆` label in the chrome style, opening dot rule retained, **no**
  closing rule — output stops while the user chooses, which terminates
  the block more definitively than a drawn line
- options as aligned bare lines with `→`, padding outside the code span
- **labels trimmed to one line**, with any condition or consequence
  lifted into the signpost above

The trim is forced rather than cosmetic: nothing in this renderer
hang-indents, so a two-line option is indistinguishable from two
options. Several labels are carrying explanation that belongs in a
signpost anyway.

## Blocked states

`properties` fence, `⚑` as the first token: turquoise flag, red
message, punctuation-safe.

The rule is **red means you cannot proceed**. Advisory callouts stay
plain — partly because the only other whole-line-safe register is spent
on tree status, and partly because a warning colour that appears on
advisories stops being a warning.

## The stack

1. **Engine width resolution** — detection chain, cap, headroom, and
   the content widths (`TREE_WIDTH`, the `surfaces.cjs` and
   `renderTree` defaults) resolving from it. Snapshots do not move at
   all: the harnesses pin `WORKFLOWS_DISPLAY_WIDTH=65`, which is the
   pre-detection width, so the goldens stay byte-identical.
2. **Tree layout** — connector, hanging indent, `# tag` column,
   `makefile` fence.
3. **Menus** — label, alignment, dot rule, and the label-trimming
   sweep with detail lifted into signposts.
4. **Blocked-state register** — `properties` fence, the red-means-
   blocked rule, the advisory split.
5. **Chrome in prose** — 107 lines across 33 files, plus the
   `CONVENTIONS.md` rewrite.
6. **Signpost unwrap** — 851 lines across 141 files; the `~70` wrap
   rule and the no-bold rule retired.
7. **Prose tests** — one complete PR at the end, re-pinning every case
   the stack moved.

Slices 1–4 are engine, 5–6 are prose sweeps that cannot break the
engine but move a great deal of snapshot surface. Prose tests are
deliberately deferred to a single closing PR rather than dribbled
through the stack.

## Open decisions

- Whether dark blue (links) earns a use, or stays deliberately unspent.
- Whether the opening dot rule on menus survives first contact — it is
  retained for now on the grounds that menus interrupt more than
  anything else does.
- Headroom: one column or two below the detected width.

## Log

- 2026-08-05 (live review, second session) — Lee's hand review of the
  stack drove a refinement round, all landed at the tip:
  - **A yes/no gate asks its question** — the rule that emerged from
    his three hand-found cases and then swept both surfaces: nine
    prose menus gained a glyphed question, four hand-wrapped question
    heads joined to one line, and the six statement-labelled engine
    gates (defer, in-session, all-done, early-completion, revisit,
    bridge continue) gained the statement-plus-question split via
    `menu()`'s new `question` option. Statement-headed route menus
    keep their statement deliberately. Codified in CONVENTIONS.
  - **The blank line is law** — the "compact yes/no may omit it"
    exception retired; label → blank → options everywhere, because
    the blank is what marks a label as a label (menuFrame's own rule).
  - **Two sweep over-reaches reverted**: the discussion-session
    subtopic-state definition list shed the alignment column the
    rendered-alignment pass wrongly gave it (option-shaped, but
    documentation), and eleven compact prompts briefly de-glyphed on a
    misread were restored.
  - **Double-diamond bug** — the bridge menu's short statement earned
    the frame's auto-glyph *and* the explicit question; the re-pin
    script faithfully pinned the bug. Caught in validation, fixed with
    `glyphLabel: false`, corpus-scanned: no golden carries two
    diamonds in one menu.
  - **The stack diverged and was rebased** — five design-log pushes to
    the base branch after the stack was cut broke linearity (per-PR
    mergeability stayed green, which is why the API check missed what
    the stack UI showed). Server-side Rebase Stack restored it. Rule
    forward: **once a stack is cut, its base is frozen** — design-log
    entries land as tip commits editing this file, exactly as this
    entry does.

- 2026-08-05 — Five review agents swept the finished stack (conventions
  accuracy, straggler hunt, engine correctness with live repros, golden
  fidelity, prose readability). The golden audit — aimed at the known
  resplice misfires — came back clean. Confirmed findings landed as one
  fix commit at the tip: rendered-length arrow alignment (mixed menus
  sat two columns apart), the makefile-fence restatement drift at
  twelve call sites, and a tail of stragglers in docs/, README, and the
  agent definitions — the systemic gap being that no sweep had covered
  anything outside skills/. Deliberately left: engine DISPLAY boxes at
  49 inside their fences (open question above), TREE_WIDTH freezing at
  module load (bites only tests that reset mid-process), and the
  glyph-length seam where the same surface flips between glyphed and
  prose labels on name length — all recorded by the engine reviewer,
  none load-bearing.

- 2026-08-05 — Slices 3–6 PR'd (#773–#776), the stack complete at six
  code layers plus this log. Findings along the way, recorded so review
  starts from them:
  - **The glyph rule moved into `menuFrame`** rather than `menu` — a
    bespoke projection's menu must render identically to a `menu()`
    one, and a leading label is detectable structurally (first line,
    blank beneath). Long or marked-up labels stay prose: markup cannot
    nest inside the glyph span.
  - **Golden re-pinning by script needs adult supervision.** The
    resplice tool located the wrong array in several tests —
    overwriting a display tree, a fixture input, and two JSON payloads
    with menu content. Every wrong splice was caught by a failing test
    and restored from git; the lesson is that the tool's output is a
    draft, not a result. One corrupted expected-block (the tasks cycle
    test) was worth a hand-written golden.
  - **The banned-nav lint collided with the arrow.** An option label
    may legitimately open with "Skip to" or "Enter" — option lines are
    inputs, not navigation directives, and the lint now exempts the
    option grammar. The dot-frame check gained the inverse: a rule
    directly below option content is a closing rule and flagged.
  - **Inline key references merged everywhere** (`` `b/back` ``, 99
    sites) so the menu row and the prose that names it share one form.
  - **Slice 6 shrank on inspection**: the 851-line estimate counted
    every short quote line; only 145 lines were genuinely wrapped
    paragraphs inside markdown-instructed fences. Artifact templates
    were protected by construction — they never carry the markdown
    emission instruction.
  - **Slice 7 dissolves.** Prose snapshots hold state, not display
    output, and no case file references an old shape — the
    deterministic perimeter never moved. What remains is walks: 48
    cases intersect the stack's diff (`select --diff main`), to be run
    selectively on command.
  - Open for review: engine-drawn display boxes still render at 49
    inside their fences (the width question slice 2 answered for stage
    dividers is unanswered for boxes — widening them to content width
    read as heavy in the design session, so they stayed).

- 2026-08-04 — Design settled end to end in one session, every register
  verified against a live terminal rather than assumed. Two early
  assumptions were refuted by measurement: that terminal width was
  unreachable, and that signpost hand-wrapping was still required.
- 2026-08-04 — Slice 2 PR'd (#772). The tag column is shared across the
  whole tree, not per depth, and tightens to a single space when the
  longest tag would otherwise be pushed past the width — visible in the
  discovery-map golden, where a 40-character tag will not fit at 65.
  The bracket form survives for plain list rows: they are not trees and
  have no column to share, which two over-eager passes of the
  re-pinning script got wrong and the tests caught. Fourth chrome
  category found while re-pinning (see above): engine-drawn dividers
  inside the fence, now sized to their content.
- 2026-08-04 — Slice 1 PR'd (#771). Detection reads the device with
  `tty.WriteStream(fd).columns` rather than spawning `stty`, so the
  cost is one `ps` per process and no shell. Pinning turned out to be
  mandatory rather than tidy: `CLAUDE_PID` reaches `process.env` in
  every suite, so an unpinned run would have rendered against whichever
  pane was open — the goldens would have moved on a resize, not on a
  code change. Pinned at the pre-detection 65, all gates green with
  byte-identical snapshots.
