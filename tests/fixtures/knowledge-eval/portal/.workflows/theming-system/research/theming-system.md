# Research: Theming System

Making Portal's Modern Vivid colour-token layer user-themeable — loading token
values from config rather than code, shipping additional built-in themes, adding
a live-preview in-app theme selector, and settling the border token names before
they become the public contract a user themes against.

## Starting Point

What we know so far:

**Prompted by** — two inbox ideas picked up together in discovery: the deferred
user-overridable theme system (external theme file, more built-in themes plus a
selector, contrast-floor validation for user colours, a documented token
vocabulary) and the rethink of the two border design-token names
(`border.separator` / `border.footer`), which are named after their first
use-site rather than their intrinsic weight. The rename matters most *before* the
theme system ships, because the role token names become the public contract.

**Existing ground** — the Modern Vivid token layer already exists
(`internal/tui/theme`: ~20 semantic role tokens, each with Light and Dark
variants; `theme.MV` is the single built-in) and every renderer already
references a token, never raw hex. So the work is changing *where token values
come from* and adding a surface to switch them — not building a theming system
from nothing.

**Lee's picture** — config-driven at the base, but with a strong preference for
selecting a theme *inside* the app and seeing the display change immediately. He
identified a concrete obstacle himself: Portal's existing modals blank the whole
screen to the canvas, so a modal-based theme picker would leave nothing visible
to preview against. His proposed answer is a new chrome shape — a TUI equivalent
of a web "slide over", occupying a strip of the right-hand side, where arrowing
down the theme list re-renders the main Portal view live behind it. Whether live
re-theming is technically achievable was deliberately parked for this phase to
answer rather than guessed at in discovery.

**Custom theme authoring is not a UI concern** — that's a configuration file.
Format undecided and open (YAML, JSON, TOML, or possibly just a flat key/value
list), with a preference for whatever is least verbose and least prescriptive
rather than a heavyweight schema.

**Starting direction** — technical feasibility (live re-theming behind a
slide-over panel; loading token values from config; contrast-floor validation for
user-supplied colours) plus general direction on theme-file format and token
naming.

**Constraints:**
- Ship at least one additional built-in theme so Portal launches with genuine
  options rather than a single built-in.
- The token rename must settle before the theme system ships (public contract).
- Existing contrast floors are numerically verified against the exact owned
  canvas (`contrast_test.go`); colour literals at call sites are guarded
  (`colour_literal_guard_test.go`).
- The visual *layout* is fixed — themes change colour only, not structure
  (carried over from the `spectrum-tui-design` redesign).
- Colours stay light/dark adaptive and truecolor-first with graceful
  downsampling; `NO_COLOR` handling already exists and interacts with this.
- Behaviour of the list/grouping/filtering layer is out of scope — this is the
  styling layer.

---

## Prior context (knowledge base)

The `spectrum-tui-design` discussion already pre-scoped this work in its
**"Theming system"** section: build the redesign token-based (in scope, done) and
log user-overridable themes as a separate initiative — external theme file,
merge-over-default, validation, multiple built-ins, a `theme` setting, docs.
Confidence recorded as "high on the split".

One thing in that discussion has since **changed the shape of the validation
problem**. Its `AdaptiveColor binary classification` decision originally treated
the contrast floor as *best-effort* because Portal didn't own its background, and
named "the eventual manual `--theme` override (the deferred user-theme
initiative)" as the escape hatch for mid-tone backgrounds. That stance was then
**REVERSED (2026-06-18)** when Portal took ownership of a mode-matched canvas:
the floor became *guaranteed*, and mid-tone / detection-misfire stopped being
legibility risks. So the theme system inherits a **cleaner** validation problem
than the seed anticipated — see "Contrast validation" below.

---

## Code grounding — what actually exists today

A read of the current code, done before the session, to replace assumption with
fact. Findings, not conclusions.

### The token layer

`internal/tui/theme/theme.go` — 185 lines. `Theme` is a **struct with 20 named
fields** (7 text-ramp, 6 accents, 7 surfaces), each a `Token{Name, Light, Dark}`.
`Token.ColorFor(mode)` picks the variant and hands it to `lipgloss.Color`.
`Theme.All()` returns the 20 tokens in stable order. `theme.MV` is a single
package-level `var` holding the built-in.

Notable: a token's identity is a **Go struct field**, and its `Name` string
(`"text.primary"`, `"border.separator"`, …) exists purely for `All()` consumers
— tests and, in the doc comment's own words, *"future theme tooling"*. So the
string names already exist but are not yet a lookup key. A config-driven theme
needs name → field resolution in some form.

### Live re-theming: the parked feasibility question

**The mechanism already ships.** Two independent findings:

1. **Call sites resolve at render time, not init time.** All 182 non-test
   `theme.MV` references across 20 files sit *inside* render functions
   (`headerStyle(theme.MV.TextPrimary, mode, colourless)` etc.), so they re-read
   the token on every `View()`. Bubble Tea re-renders the whole frame each
   `Update`, so a swap of the active theme is picked up on the next frame with
   **zero call-site churn**. Exactly **one** package-scope exception:
   `internal/tui/pagepreview.go:35` — `var previewBorderColorToken =
   theme.MV.AccentCyan` copies the `Token` struct at init and would not see a
   swap.

2. **Portal already performs a mid-session restyle.** `model.go`'s
   `applyResolvedMode` / `applyCanvasMode` / `applyProjectCanvasMode` exist
   because the OSC 11 appearance query is *async and non-gating* — it can answer
   *after* the first paint, at which point the model re-points its stateful leaf
   styles (session + project delegates, `bubbles/list` help styles, pagination
   dots, the outer canvas fill) at the newly-resolved mode. This is functionally
   the same operation a live theme switch needs, already in production and
   exercised on every auto-appearance run.

   The corollary is where the real work sits: `applyCanvasMode` exists precisely
   because some styles **are** cached rather than re-derived per frame — the
   `bubbles/list` internals Portal doesn't own. Those are the sites a live theme
   swap must go through, and any future cached style must be added there.

3. **The canvas is the awkward one.** `Canvas` isn't only painted per-cell — it
   is also SET as the *terminal default background* via OSC 11 (`restore.go`), so
   the canvas reaches the window gutter. A live theme change therefore has to
   re-emit OSC 11 mid-session. And `restore.go`'s canvas-echo guard compares the
   captured "original" background against `canvasHexFor(m.canvasMode)` — with
   themes, "the canvas Portal painted" becomes a *set* of possible hexes across a
   session, not one, so the guard's comparison needs revisiting. This is the one
   genuinely fiddly mechanic in the live-preview picture, and it lives in a place
   that already carries a "do **not** drop this guard" warning.

### Two axes, not one

Every token carries **both** a Light and a Dark variant, and mode is chosen
independently by the `appearance` pref (`auto|light|dark`) plus OSC 11 detection.
So "which theme" and "which mode" are **orthogonal axes**, and a *theme* is a
pair of palettes rather than one. Open: whether a user theme must supply both
variants, and what happens when it supplies only one.

### Contrast validation

Today the floor is enforced **at test time**, numerically: `theme/contrast_test.go`
(509 lines) measures each token's Light variant against `#e1e2e7` and each Dark
variant against `#0b0c14` — the *exact* owned canvas hexes. The MV values carry
inline erratum comments recording original → corrected hex and the measured ratio
(six light hexes were darkened to clear the floor).

Two consequences for user themes:

- The canvas is **itself a token**, so a user theme changes the very background
  the floor is measured against. The check becomes "each token vs *this theme's*
  canvas" — self-consistent and computable at load time, without knowing anything
  about the terminal. That is a materially easier problem than the seed's framing
  ("Portal does not own the terminal background") — canvas ownership retired that
  worry.
- Several floors are **3:1 (UI/accent)** and others **4.5:1 (text)**, and some
  tokens are measured against a *tint* rather than the canvas (`text.strong` and
  `state.green` on `bg.selection`; `text.on-warning` on `bg.warning`). So the
  validation rule isn't one uniform "token vs canvas" sweep — there is a
  per-token pairing table implied by the existing test, and a runtime validator
  would need that relationship encoded as data rather than as test cases.

### Guard tests that will need reshaping

- `theme/theme_test.go` — `TestMVDarkVariantsPinned` pins all 20 dark hexes
  exactly; `TestMVTokenCount` pins the count at exactly 20 (closed vocabulary).
  Both are MV-specific by construction; additional built-ins need their own
  treatment, and the count guard's meaning shifts from "MV has 20" to "the
  vocabulary is 20".
- `internal/tui/colour_literal_guard_test.go` — AST-parses every production file
  in `internal/tui` (via a glob, so coverage grows automatically) and fails on any
  raw literal passed to `lipgloss.Color`. The `theme/` subpackage is the only
  sanctioned home for raw colour values. A config loader that parses user hex
  strings introduces a *second* place raw colour values enter the system — the
  guard doesn't cover it (different package) but the invariant it protects is
  worth thinking about.

### Other touchpoints

- `internal/capture/swatch.go` references `theme.MV` — the offline visual-capture
  harness (`cmd/capturetool`, `testdata/vhs/`). New themes imply a decision about
  fixture/reference-PNG coverage: capture every theme, or one canonical.
- Config resolution already exists (`cmd/config.go` `configFilePath`, per-file env
  var → `XDG_CONFIG_HOME/portal/` → `~/.config/portal/`), as does the one-shot
  legacy-path migration and the log-component mapping. `prefs.json`
  (`internal/prefs`) already holds the `appearance` override and is deliberately a
  **leaf** (no `internal/log`) — the natural existing home for a persisted `theme`
  selection.

### The one real architectural tradeoff surfaced so far

`theme.MV` is a package-level global read directly at 182 call sites. Making the
active theme switchable is a choice between:

- **Mutable package state** — `theme.Active` var + setter, or an accessor
  function. Near-zero call-site churn; but package-level mutable state, and the
  render path becomes order-dependent on the setter.
- **Explicit plumbing** — pass a `Theme` (or a resolver) down through the
  renderers. Idiomatic and test-friendly; but a large mechanical change across
  182 sites plus signature churn on every render helper, and the existing
  functions already thread `mode` and `colourless` — a third parameter.

Both are viable; the tradeoff is Go-idiom cleanliness versus blast radius. Not a
decision for this phase.

---

## The slide-over becomes an appearance surface too, not just a theme list

Lee's reaction to the two-axes finding: put the **light / dark / auto** picker in
the slide-over as well. His reasoning — that setting exists today but is
*config-only* (`prefs.json` `appearance`), and this is the opportunity to make it
TUI-configurable rather than a file edit.

That is feasible on the same seam, with one wrinkle. `appearance` is read **once
at TUI construction** (`WithAppearance` in `cmd/open.go`) and its value gates
whether OSC 11 detection runs at all — `light`/`dark` *pin* the canvas and skip
both detection and the ~50ms first-paint wait. So:

- **auto → light/dark** is trivial: set `canvasMode`, re-apply, re-emit the canvas
  OSC 11, persist.
- **light/dark → auto** is the interesting direction: detection has to run *now*,
  mid-session. Mechanically fine (there's no first-paint gate left to win), but the
  appearance gate's designed invariant is **single-resolution, never
  paint-then-flip** — and switching to `auto` live *is* a paint-then-flip by
  nature. The invariant was written for startup, so this isn't a contradiction so
  much as a case the gate was never asked to handle.

Worth noting both axes converge on the same machinery: **theme change and
appearance change are the same re-apply + re-emit-OSC-11 operation**, differing
only in which input moved. The slide-over is one panel driving two settings
through one seam.

Scope observation (not a proposal): `prefs.json` currently holds exactly two
things — `session_list_mode` and `appearance`. If the slide-over becomes the home
for `appearance`, then one pref is adjusted by a keybind cycle (`s`) and the other
by a panel. There's a latent consistency question there about what a "settings
surface" in Portal is, which this work will brush against whether or not it
answers it.

## Paired vs split: is "one theme carries both variants" the right model?

Lee raised this himself and explicitly invited the discussion: today a theme is
`{20 tokens} × {light, dark}` — one theme, two variants. The alternative is
`theme = one palette` tagged light or dark, so "Tokyo Night Dark" and "Tokyo Night
Light" are two separate themes and the appearance axis selects between them.

**The central reframe: splitting does not remove the pairing, it relocates it.**
`auto` mode is the reason. Under `auto`, detection says "the terminal is light" and
something must know *which* palette to use — so a split model still needs a
light↔dark relationship, expressed either as a naming convention
(`gruvbox-light`/`gruvbox-dark` — fragile and prescriptive), as two settings
(`theme.light` / `theme.dark`), or as metadata inside the theme (`variant:` plus a
`pair:` pointer — which is pairing again, just externalised). So the real question
is **where the pairing lives**, not whether it exists.

### Arguments the current paired model is right

- **It's what the code already is.** `Token{Name, Light, Dark}` + `ColorFor(mode)`.
  Zero migration, zero call-site churn.
- **The appearance axis stays genuinely orthogonal.** `auto` can flip light↔dark
  without changing theme *identity* — the user picked "Tokyo Night" and stays on
  Tokyo Night all day. That's a clean conceptual model.
- **One selector list**, and arrowing through it never changes the canvas mode —
  so live preview is a pure colour change with no mode flip mid-scroll.

### Arguments for splitting

- **The whole terminal ecosystem is single-palette.** base16/base24, iTerm2
  `.itermcolors`, Alacritty, WezTerm, Zellij, Helix, `bat`/`delta` — one palette
  per file, with "Gruvbox Light" and "Gruvbox Dark" as two named themes. If Portal
  ever wants theme files that are recognisable to (or cribbable from) that
  ecosystem, single-palette matches convention.
- **Authors only care about the mode they use.** Paired forces every author to
  either design both halves or leave one undefined — which is precisely the
  "what renders if the mode is undefined?" open question below. Split makes that
  question disappear: an author writes exactly one palette and nothing is missing.
- **The asymmetry is real, and Portal's own code is the evidence.** A good light
  palette is not a mechanical lightening of a good dark one. In MV, six light
  hexes had to be *individually* darkened with erratum comments to clear the
  floor, and the three light surface tints were **eyeball-pinned at a validation
  gate** rather than derived. MV's light and dark are, in practice, two
  independently-tuned palettes that happen to share token names — the paired
  struct implies a derivation relationship that doesn't actually exist.
- **It would collapse `mode` out of the render layer.** `theme.Mode` is currently
  threaded as a parameter through essentially every render helper in
  `internal/tui` (`headerStyle(tok, mode, colourless)`, `renderDeleteModalContent(…,
  mode, colourless)`, and so on across ~20 files), and its only job is choosing a
  variant — it is always passed straight down to `ColorFor`. If the active theme
  were already resolved to a single palette, `Token` collapses to `{Name, Value}`,
  `ColorFor` disappears, and `mode` stops needing to reach renderers at all. That
  is a substantial simplification of the render layer — and simultaneously a
  substantial mechanical change to make.

### Consequences that cut across both

- **Live preview behaves differently.** Under paired, arrowing the theme list never
  changes light/dark. Under split, arrowing onto a light-only theme while in dark
  mode must either flip the canvas (arguably *more* honest — you see the theme as
  designed) or refuse/filter it (the list shows only themes matching the current
  mode). Both are defensible; they're different products.
- **Ghostty solves this exact problem in its own config** with a mode-mapped theme
  setting (a single theme name, *or* a light/dark pair in one setting) — a directly
  relevant precedent, and Portal already has a native Ghostty spawn adapter. Worth
  verifying the exact shape rather than trusting recollection.
- **Validation is indifferent.** Each variant is already measured against its own
  canvas independently, so the floor check works the same either way.

## What `appearance: ""` means, and what Lee's test does / doesn't prove

Lee's local `prefs.json` carries `"appearance": ""`. Traced: `parseAppearance("")`
hits the tolerant-decode default → **`AppearanceAuto`**. So he is on auto, and the
detect-or-timeout gate *is* arming. Everything is wired correctly —
`tea.RequestBackgroundColor` is issued from `Init` (`model.go:2130`), the reply is
classified by `msg.IsDark()` (`model.go:2229`), and a 50ms `tea.Tick` races it to
the dark fallback.

He switched to light mode and Portal stayed dark, across a restart. Two readings,
and they are **not** equivalent evidence:

1. **OSC 11 got no usable reply inside 50ms.** Plausible — the
   `spectrum-tui-design` discussion explicitly flagged that Portal runs *inside
   tmux*, "where bg-detection passthrough is unreliable". Under this reading auto
   is ineffective in Lee's actual environment.
2. **The terminal never actually changed.** If Ghostty is configured with a fixed
   theme rather than a light/dark-mapped one, switching *macOS* appearance changes
   nothing about the terminal's background — and Portal reporting dark would be
   **correct**, not broken.

Unresolved which. Noting it because "auto doesn't work" and "auto worked, my
terminal just didn't change" are different justifications for removing auto — even
though, as below, the case for removal doesn't actually rest on either.

## Proposal (Lee): delete the appearance axis entirely

Lee's position after the above: **remove `auto`, and remove light/dark as an
appearance/config concept altogether.** Split MV into `Tokyo Night Dark` and
`Tokyo Night Light` as two ordinary themes, so nothing is lost — the existing
values survive as two entries in the theme list. Theme selection is manual, in the
TUI. Rationale: terminal *applications* generally don't auto-switch (you pick a
theme), and Portal is a transient UI, so a mismatch is not fatal.

### This is a much larger simplification than the theme model alone

The thing worth surfacing: `appearance` is not merely a setting. It is the **sole
reason the appearance gate exists**. If the chosen theme already answers "light or
dark", then the following all lose their only consumer:

- **`internal/tui/appearance_gate.go` in its entirety** (167 lines) — the
  detect-or-timeout race, `appearanceTimeoutMsg`, `arm()`, `resolveFromDark`,
  `resolveDark`, the single-resolution / no-flip invariant, the pending
  blank-first-frame.
- **The 50ms first-paint wait.** In auto mode today the first *real* paint is held
  behind a neutral blank frame for up to 50ms waiting for OSC 11. Delete the axis
  and Portal paints the correct canvas on frame one, always, with no race to win.
  That's a startup win *and* the removal of the trickiest timing code in the TUI.
- **`prefs.Appearance`** — the enum, its tolerant decode, `LoadAppearance` /
  `SaveAppearance`, and `WithAppearance`.
- **`Token.ColorFor` and `theme.Mode` threading.** `Token` collapses to
  `{Name, Value}`; the `mode` parameter stops travelling through ~20 files of
  render helpers.
- **The dual-canvas contrast bookkeeping.** Each theme is validated against *its
  own* canvas, one palette at a time — no light-vs-`#e1e2e7` / dark-vs-`#0b0c14`
  split, and no erratum comments recording which background a ratio was measured
  against.
- **The paired-vs-split question itself**, which was only hard *because* `auto`
  needed a light↔dark pairing. Remove auto and the pairing has no consumer. The
  slide-over becomes one list on one axis.

### What does *not* disappear (precision matters here)

- **The OSC 11 *query* stays.** `restore.go` captures the original terminal
  background in order to restore it on exit — independent of detection. What dies
  is the *classification* and the race, not `tea.RequestBackgroundColor`.
- **The canvas-echo guard stays** (and keeps its "do not drop this" status); its
  comparison just re-points from "the mode's canvas" to "the active theme's
  canvas".
- **`NO_COLOR` still needs its carve-out**, but gets simpler: it currently rides
  the gate as `newColourlessGate` — a gate whose only job is to skip a race. With
  no race, NO_COLOR becomes plainly "suppress canvas and colour".

### Honest costs

- **First-run mismatch becomes sticky.** A light-terminal user's first launch is
  dark until they change it. Today auto *sometimes* gets that right; under the
  proposal it never does by itself. Traded for a reliable worst case and a large
  simplification — but it is a real regression in the best case.
- **Mismatch is more visible for Portal than for most TUIs**, precisely because
  Portal *owns* the canvas and sets the terminal default background — a dark
  Portal in a light terminal repaints the window rather than blending into it. That
  cuts both ways: it makes a mismatch louder, *and* it removes any "blend in
  quietly" option that auto might otherwise be protecting. Portal is imposing a
  background either way, so the argument that the user should simply choose it has
  force.
- **A prefs migration decision.** Existing files carry `appearance`. Tolerant
  decode means dropping the field is graceful (it becomes dead data), but there's a
  choice about whether to *translate* a persisted `light`/`dark` into a default
  theme selection on first run, or just ignore it.
- **This reverses a spec decision that was itself a reversal.** §2.6's
  detect-or-timeout gate replaced the earlier "best-effort + `--theme` override"
  stance when canvas ownership landed. This would be the third position on the same
  question — not a criticism (the ground genuinely moved each time), but the spec
  edit is real and a body of tests pinning the gate's invariants would be deleted
  (two dedicated test files, `appearance_detection_test.go` and
  `appearance_option_test.go`, plus references across ~8 more).

### On the premise

Lee's claim that terminals don't usually have auto mode is **right where it
matters and wrong where it doesn't**. Terminal *emulators* increasingly do have it
(Ghostty's mode-mapped theme setting, iTerm2's separate light/dark presets, Windows
Terminal). Terminal *applications* — `bat`, `delta`, Helix, lazygit, k9s — almost
universally do not: you name a theme and that's the theme. Portal is an
application, so the convention he's invoking is the applicable one. Vim/Neovim's
`background=light|dark` is the notable counter-example, and it is set by hand.

## Separating "persistent preference" from "initial guess"

Lee raised a middle option: use detection **only** to pick a theme on first load,
and never re-apply it once something is configured. This is the most useful
distinction to come out of the thread so far, because it splits two jobs that
`appearance` currently conflates:

- **Job A — what does the user want, persistently?** A *preference*. Detection is
  bad at this: it's unreliable inside tmux, and re-inferring on every launch means
  a flaky detect can flip the UI between runs. That inconsistency is probably a
  large part of why auto *feels* broken even when it's working as designed.
- **Job B — what's a sensible starting guess?** A *seed*, consumed once.
  Detection is fine at this, because a wrong one-time guess is a one-time
  annoyance the user corrects once, permanently.

**The key structural point: the seed approach keeps nearly all the
simplification.** The large wins come from "a theme carries its own canvas, so
there is no light/dark axis" — *not* from "never look at the terminal
background". Those are separable:

- The gate's **first-paint blocking role disappears either way**, because a
  persisted theme is known at construction. Nothing to race, paint on frame one,
  50ms wait still deleted.
- `theme.Mode`, `Token.ColorFor`, the dual-canvas contrast bookkeeping,
  `prefs.Appearance`, and the paired-vs-split question are still all gone.
- What comes back is small: a **non-blocking, best-effort, one-shot** read of the
  OSC 11 reply, used to choose between two defaults and then persisted. It needs
  no race and no timeout, because nothing is gated on it.
- And the reply is **arriving anyway** — `restore.go` already needs the OSC 11
  query to capture the original background for restore-on-exit. Reading that same
  reply once to pick a default is close to free.

Residual costs: a first-run-only paint-then-flip if the light reply lands after
first paint (mild, and only ever once), plus a small amount of code. The real
hazard is scope creep on the trigger condition — if it fires on anything other
than "the user has never chosen", the between-runs flakiness comes straight back.

## Shipping a default: the options

Whatever happens, Portal must boot with *a* theme. Four shapes on the table.

### 1. Hardcoded default, manual change thereafter

Dark, and this doesn't look like a close call:

- **MV is dark-first by construction.** The package doc says so, `theme.Mode`'s
  zero value is Dark *on purpose*, and the dark hexes are the pinned §2.9
  authoritative source. The light variants were derived afterwards and needed six
  individual corrections plus three eyeball-pinned surface tints. The dark palette
  is simply the better-tuned artifact.
- **The failure mode is symmetric and safe.** Canvas ownership guarantees the
  contrast floor in both directions, so a mismatch is *jarring, never illegible*.
  That reduces the choice to base rates, and terminal users skew dark.
- It keeps an existing documented fallback rather than making a new decision.

### 2. Detection as a first-run seed

Composes with (1) rather than replacing it: default is the dark theme; on first
run only, if OSC 11 reports light, start on the light theme instead and persist.
Hardcoded default is the floor; detection is an optional improvement on top. Fails
safe by construction.

### 3. First-run modal asking the user to pick

Worth pushing back on, for two structural reasons rather than taste:

- **"First run" isn't reliably a TUI moment.** Portal's dominant entry point is
  `portal open` / the `x` function, and a bare positional resolves and attaches
  **directly via `syscall.Exec` without ever showing the picker**. So a first-run
  modal either has to block a non-TUI path (bad) or fire only when the picker
  happens to open first (inconsistent).
- **Modals blank the screen to the canvas** — the exact problem that pushed the
  theme selector toward a slide-over in the first place. A theme-picking *modal*
  has nothing to preview against, so the first-run experience would be strictly
  worse at picking a theme than the normal slide-over is.

Also: it asks the user to choose before they've seen the app or any theme. The
counter-argument (explicit, honest, one interruption ever) is real but doesn't
answer the two structural points.

### 4. No persisted default at all — resolve to dark at read time

Not raised, but worth having on the table because it interacts with (2): if
"unconfigured" stays *distinguishable* from "explicitly chose dark" (i.e. nothing
is written to `prefs.json` until the user picks), then the seed can fire on any
launch where the user has never chosen — not just a literal first run. A failed
detect gets another chance next launch, and no first-run bookkeeping is needed.
Persist on first successful detect and the window closes cleanly.

### A naming consequence

The seed flagged that *token* names become a public contract a user themes
against. **Theme names are the same class of problem** — once `tokyo-night-dark`
is a string users write in config (and that ships as the default), renaming it
breaks their config. Worth settling deliberately alongside the border-token
rename rather than falling out of implementation.

## Assessment (SUPERSEDED — kept for the record)

> **Read this section with two later corrections in hand.** Its ecosystem paragraph
> was explicitly flagged as recollection and was subsequently **refuted** — see
> Appendix A1: `bat`, `delta`, Neovim and `yazi` all detect light/dark **by
> default**. And its "detection is unreliable" argument was later shown probably
> never to have been true in this environment (see "This retroactively resolves the
> ambiguous test"). The session's actual landing is in "Terminal vs OS", below.

Asked directly for a read, with the reasoning rather than just the verdict:

**Removing the light/dark appearance axis looks right**, and the strongest argument
is not the code deletion — that's a consequence, not a reason. It's that the axis
**infers something it cannot reliably infer, in order to make a choice the user is
better placed to make**, and Portal's own history documents the unreliability
(tmux passthrough). An unreliable inference driving a loud outcome — Portal
repaints the terminal background — is a poor trade.

The "third position on the same question" concern also looks weaker on inspection.
Read the arc: (1) don't own the background, best-effort adaptive plus an override
escape hatch; (2) own the canvas, guarantee the floor, detect *which* canvas;
(3) own the canvas, let the user name it. Every step **reduced the amount of
inference**. This is the same direction of travel one step further, not
vacillation.

**What the ecosystem does** (from recollection — flagged as the thing a deep dive
should verify rather than trusted): terminal *applications* overwhelmingly default
to a single named theme and let the user set it — `bat`, `delta` (defaults dark,
`--light`/`--dark` by hand), Helix (`theme = "…"`), lazygit, k9s, Zellij. Auto
light/dark detection lives mostly at the *emulator* layer (Ghostty's mode-mapped
theme setting, iTerm2 presets, Windows Terminal), and where applications do offer
it, it tends to be opt-in rather than the mechanism. Neovim's `background` is the
notable counter-example and is set by hand. That pattern supports: hardcoded
sensible default + manual selection, with detection as a convenience rather than
the mechanism.

Net: option **(1) + (2)**, and specifically (2) implemented via the (4)
"unconfigured is distinguishable" shape, gets the user close to right without
making detection load-bearing. Option (3) has structural problems in Portal
specifically.

## The slide-over: overlay, and the mechanism already ships

Lee's picture clarified: the panel **overlays** the right-hand side. Content does
not shrink or reflow — it stays exactly where it is and the panel draws on top of
it. "Much like the modal, but fixed to the right-hand side as a list" — the
difference from a modal being that a modal blanks the background and the slide-over
does not.

**This is already implemented in Portal.** `internal/tui/pagepreview.go:731-747`
(`overlayHelpOnPreview`) composites the `?` help panel over the Preview page using
z-ordered layers:

```go
background := lipgloss.NewLayer(preview).X(0).Y(0).Z(0)
foreground := lipgloss.NewLayer(panel).X(x).Y(y).Z(1)
return lipgloss.NewCompositor(background, foreground).Render()
```

Its doc comment states the exact principle Lee described — *"the preview content
stays visible behind it (§9 — the Preview `?` help overlays, it does NOT blank).
… leaving every cell outside the panel showing the preview underneath."* So the
non-blanking overlay is not a new chrome shape at the mechanism level: it is an
existing, shipped, spec-sanctioned one, currently used at one site. The slide-over
is that same call with `X` pinned to the right edge and full height instead of
centred.

Verified: `charm.land/lipgloss/v2 v2.0.4` ships genuine compositing —
`Layer` with `X`/`Y`/**`Z`** and nested `AddLayers`, plus `Compositor` with
`Render()` and `Hit(x, y)` (mouse hit-testing, which a clickable panel could use
later). No ANSI-aware string surgery required; this is a first-class API. Portal
uses it at exactly one site today.

### What overlay buys and what it costs

- **It sidesteps the pagination-invariant risk entirely.** The list's width and
  height are untouched, so nothing reflows, no height re-budget, no
  one-row-per-delegate perturbation. That was the main hazard in the shrink-to-fit
  alternative and overlay removes it rather than managing it.
- **The owned canvas makes overlay clean.** Because Portal paints an opaque
  backdrop on every cell, the panel's cells are fully opaque with no transparency
  artefacts. In a TUI that leaves the terminal background showing through, an
  overlay panel tends to look broken — canvas ownership is what makes this tidy.
- **But it hides the right-hand column, which is where Portal puts information.**
  This is the honest cost and it isn't "covering empty space": the footer's
  right-aligned `? help` (`right_anchored_row.go`), the right-side header hint, and
  session row meta all live at the right edge. Shrink-to-fit would hide nothing but
  pay reflow; overlay pays no reflow but hides the informational edge. A genuine
  tradeoff, and it argues for thinking about *what* sits behind the panel, not just
  the panel.
- **Narrow terminals need a separate answer.** `header.go` pins
  `minTerminalWidth = 40` with staged degradation below it. A usably-wide panel
  (~24–30 columns) over a 40-column terminal covers most of the screen, at which
  point the overlay degenerates into "a modal that doesn't blank" and there is
  almost nothing left visible to preview against — defeating the reason for
  choosing a slide-over. Some threshold behaviour is needed.

### Naming hazard

`lipgloss.Canvas` is a *different concept* from Portal's "owned canvas" (the
painted mode-matched backdrop). Both terms are now in play in the same feature.
Worth keeping them lexically separate in the spec so they don't get conflated.

## Live-preview semantics: apply-on-arrow

Lee's model: arrowing the list **sets** the theme for real; `Esc` just closes the
panel; the theme stays set. No separate commit step.

Methodological note he was right to make: the earlier framing let *existing code*
constrain the design question. The feature is allowed to change the code — the
question is what the right behaviour is, then whether it's implementable.

### Two established idioms, and his is one of them

- **Picker idiom** — hover previews, `Esc` **reverts** to what was active, `Enter`
  commits. VS Code's theme quick-pick, Telescope's `colorscheme` picker.
- **Settings-panel idiom** — a change applies immediately and there is no cancel.
  iTerm2's appearance prefs, and most application settings surfaces.

Lee's model is the settings-panel idiom. It is coherent, and more importantly it is
**consistent with Portal's own existing behaviour**: the `s` grouping-mode toggle
already persists on every press with no undo. Internal consistency is the stronger
argument here than matching VS Code.

Its one honest cost: **no escape hatch from a bad landing.** Arrow through eight
themes, dislike where you stopped, and you have to *remember* what you had. Trivial
with two or three built-ins; less so with a growing user library. A cheap mitigation
that preserves the model completely: mark the theme that was active when the panel
opened (Portal already has a marker vocabulary — `●`). "Get back" becomes visible
rather than remembered, with no revert machinery and no shadow state.

### Is it possible — yes, and the OSC 11 concern was overstated

**Correction to the earlier framing.** Bubble Tea v2 **diffs** the view's
background colour and only emits when it changes —
`bubbletea/v2@v2.0.7/cursed_renderer.go:411-432`:

```go
{newColor: view.BackgroundColor, oldColor: lbg, reset: ansi.ResetBackgroundColor, setter: ansi.SetBackgroundColor},
…
if c.newColor != c.oldColor { … s.scr.WriteString(c.setter(col.Hex())) }
```

So there is no per-keystroke churn. Hovering N themes emits OSC 11 exactly once per
*distinct* canvas landed on — the minimum possible, and precisely what the feature
requires. The declarative `v.BackgroundColor` assignment per frame is not a
per-frame write.

**The `restore.go` echo-guard concern also dissolves on inspection.** That guard
exists because the startup OSC 11 *query reply* can race Portal's own canvas set.
The query is issued once, from `Init`. A later theme switch issues no new query, so
it creates no new race — the guard only ever needs to compare against the canvas
active during the *startup* window, not the currently-active one. (This holds whether
or not the appearance axis is removed: `restore.go` needs the query regardless, for
the original-background capture.)

**CORRECTION — "no new machinery" was too confident.** The reasoning above holds, but
the code does not currently express it: `RestoreTerminalBackground` derives its
comparison value *at exit* from `m.canvasMode` via `canvasHexFor`, which reads
`theme.MV.Canvas` **directly** — a hardcoded MV reference sitting outside the token
render path, and therefore one of the sites "every renderer references a token" does
not cover. Anchoring to the startup canvas means (a) capturing and retaining that hex
as new model state, and (b) making `canvasHexFor` stop being MV-specific. Small in
absolute terms, but it lands on the one mechanic carrying an explicit "do **not** drop
this guard" warning.

### Settled in session: persist on close, marker, no revert key

Lee's refinement: mark the theme active when the panel opens (yes), **no special
keybinding to get back to it** (deliberately not added — the marker is
informational, not an affordance), whatever you're on when you close is what's
saved, and the panel carries a **visual statement of the contract** — an
"escape closes / saves on close" hint.

That resolves the persist-timing question in favour of **persist on close**, which
is also the no-write-storm option. It makes the marker self-consistent: the marker
shows the *persisted* theme, so if you close on a different one the marker has
moved next time you open. One coherent story rather than two mechanisms.

Two consequences worth recording.

**The contract hint sits along the top of the panel, not the bottom** (Lee's
clarification). That side-steps the footer question entirely: Portal's footer is
descriptor-driven (`keymap.go`, `keymapEntry` with `Core` / `RightAligned` /
`Destructive`), consumed by *both* the footer and the `?` help, with
`keymap_dispatch_guard_test.go` guarding descriptor↔dispatch drift, and every entry
there is a `key + action-label` pair. A statement about behaviour ("saves on close")
doesn't fit that vocabulary — but as panel *header* chrome it doesn't need to, and
needs no descriptor entry.

**"Applied but not persisted" becomes a reachable state.** Under persist-on-close,
if Portal dies while the panel is open — `Ctrl-C`, terminal closed, or any exit path
that isn't "close the panel" — the visually-applied theme was never written, and the
next launch comes back on the marker. That is arguably *correct* (you never finished,
so nothing saved) and it is defensible, but it is a state that simply cannot exist
under write-per-arrow. Worth being a deliberate choice rather than a side effect.

### The one thing apply-on-arrow genuinely does need decided

Visual application and *persistence* are separable, and only the second is
awkward. "Arrow sets the theme" taken literally means a `prefs.json` write per arrow
keypress. Apply-on-arrow visually while persisting on panel close (or debounced)
gives byte-identical UX with no write storm. Same idiom, different write cadence —
worth choosing deliberately rather than inheriting the `s` toggle's write-per-press
behaviour by analogy.

## VERIFIED: the mode-2031 chain works in Portal's stack today

The deep dive named this as its single most load-bearing unverified item. Checked
directly against the pinned dependency versions — **the whole chain is present and
needs no upstream change.**

**1. `github.com/charmbracelet/x/ansi v0.11.7` has full mode-2031 support:**

```go
ModeLightDark        = DECMode(2031)
SetModeLightDark     = "\x1b[?2031h"
ResetModeLightDark   = "\x1b[?2031l"
RequestModeLightDark = "\x1b[?2031$p"
RequestLightDarkReport = "\x1b[?996n"   // poll current state
func LightDarkReport(dark bool) string  // "\x1b[?997;1n" / "\x1b[?997;2n"
```

**2. `ultraviolet` decodes the report into typed events** (`decoder.go:428-440`):
DSR `997;1` → `DarkColorSchemeEvent{}`, `997;2` → `LightColorSchemeEvent{}`.

**3. Bubble Tea v2 delivers them to `Update` without wrapping.** This is the part
that could have blocked it, and it doesn't: `tea.go:50` declares
`type Msg = uv.Event` — a **type alias**, not a distinct type — and
`translateInputEvent` (`input.go`) ends with a bare `return e` for any event it has
no explicit case for. It has no case for the two colour-scheme events, so they
arrive in `Update` verbatim as `uv.DarkColorSchemeEvent` / `uv.LightColorSchemeEvent`
and can be type-switched directly. No fork, no upstream PR, no parsing by hand.

**4. Portal must opt in itself, and there is a sanctioned route.** Bubble Tea does
not enable 2031 on its own (the renderer sets bracketed paste, focus, mouse,
alt-screen, synchronised output and unicode-core — not 2031) and ships no
`Request…` Cmd for it. But `tea.Raw(any) Cmd` (`raw.go`) exists precisely for this,
documented as *"for advanced use cases where you need to query the terminal or send
escape sequences directly"*, and the program `execute`s it verbatim
(`tea.go:858`). So `tea.Raw(ansi.SetModeLightDark)` from `Init`, optionally with
`tea.Raw(ansi.RequestLightDarkReport)` to poll immediately rather than wait for a
push.

**5. Environment check: the installed tmux is 3.7b, not the 3.6b CLAUDE.md
records.** Mode 2031 landed in tmux 3.6, so it is available — and the local
environment is a release newer than the documented target. (Minor doc drift worth
noting separately.)

### What this changes

The premise that *"bg-detection passthrough is unreliable inside tmux"* — inherited
from the `spectrum-tui-design` discussion, repeated in Portal's README, and used in
this session as an argument for deleting the appearance axis — was formed against
**OSC 11**, a colour query the app must classify by luminance and race with a
timeout. Mode 2031 is a different mechanism: a *semantic* light/dark answer, pushed
on change, which tmux synthesises even when the outer terminal cannot answer.

That does not decide anything, but it does mean the appearance question should be
re-opened in discussion against the 2031 mechanism rather than against OSC 11.

### CORRECTION — 2031 answers a *different question* than OSC 11

The paragraph above originally continued *"the 'detection is unreliable' leg of the
removal argument is no longer supported"*, on the basis that 2031 is a better answer
to the same question. **That was wrong**, and the packages Portal would consume say
so explicitly. Verified in source:

- `ansi/mode.go:642` — *"ModeLightDark is a mode that enables reporting the
  **operating system's** color scheme (light or dark) preference."*
- `ultraviolet/event.go:321,326` — *"DarkColorSchemeEvent is sent when the
  **operating system** is using a dark color scheme"*, and its light counterpart.

OSC 11 answers **"what colour is my terminal's background?"**. 2031 answers **"what
appearance is the user's OS set to?"**. Those are different signals that routinely
disagree — and Lee's own ambiguous manual test is precisely the disagreement case: a
Ghostty pinned to a fixed dark theme on a light macOS. Under OSC 11 Portal correctly
reads dark; under 2031 it would read **light**, not flakily but *systematically*.

Two wrinkles cutting the same way:

- tmux's own CHANGES entry says it *"will guess the theme from the background colour
  on terminals which do not themselves support the escape sequence"* — so on the
  synthesis path 2031 returns a **background-luminance guess**, the very signal whose
  unreliability was the original objection. Same escape sequence, two different
  underlying questions depending on who answers.
- A1 in the appendix already recorded that the emulator layer "tracks the *OS*
  appearance, not the terminal's colours". The contradiction was present in this
  document and went unnoticed.

**Revised conclusion.** What is established is narrower than first written: a
detection mechanism exists, is plumbed end-to-end in Portal's stack, and does not
suffer OSC 11's race. What is **not** established is that it answers the question
Portal wants answered.

**Still unverified (needs a real terminal, not code reading):** whether
Ghostty → tmux 3.7b → Portal produces the event in practice. Note this would confirm
the *code path only* — it cannot settle which question the answer represents, so it
must not be treated as settling the argument above.

### The unstated payoff — what is detection actually FOR?

Never asked, and it sits upstream of everything else in this thread. Portal **owns an
opaque canvas** and guarantees its contrast floors against that canvas — this document
says repeatedly that a mismatch is *"jarring, never illegible"*. If legibility is
guaranteed either way, then detection's entire payoff is **aesthetic blending** with
the surrounding terminal. That is a real but modest benefit, and naming it matters
twice: it is what the "follow the terminal continuously" job should be costed
against, and it is what discriminates the two signals —

- **Aesthetic blending with the terminal** → wants the terminal's background →
  **OSC 11** is the right signal and 2031 is the wrong one.
- **Following the user's system-wide preference** → wants the OS scheme → **2031** is
  the right signal.

Portal needs to know which it wants before it can judge whether 2031 supplies it.

## The false dichotomy: detection and pairing are independent axes

The session has been treating "keep auto-detection" and "each theme ships light +
dark" as one package, and flipping between the package and its opposite. The
ecosystem shows they are **two separate questions**, and all four combinations
ship somewhere:

| | **Detect light/dark** | **No detection** |
|---|---|---|
| **Theme carries both variants** | Portal today; tmux 3.8 (`theme detect` + `dark-theme-*`/`light-theme-*`) | Pick a theme, pin the mode by hand |
| **Theme is one palette** | **Helix** — `[theme] dark = "x", light = "y", fallback = "z"`; also bat (`--theme-dark`/`--theme-light`), yazi, Zellij (`theme_dark`/`theme_light`), kitty's `*.auto.conf`, Ghostty's `theme = light:X,dark:Y` | The single most common shape: `theme = "name"` |

The bottom-left cell is the one this session never considered: **auto-detection with
single-palette themes**, where detection picks between two *named themes* rather than
between two variants inside one theme. It is also the best-articulated version found
anywhere — Helix's config enum carries an explicit third value for "the terminal
declared nothing":

```rust
Adaptive {
    light: String,
    dark: String,
    /// A theme to choose when the terminal did not declare either light or dark mode.
    /// When not specified the dark theme is preferred.
    fallback: Option<String>,
}
```

So **wanting auto-detection does not commit Portal to the paired model.** That is
the main thing to carry into discussion.

### Where the evidence actually points, per axis

**Detection axis — the evidence moved decisively toward "it's viable".** Mode 2031
is verified present end-to-end in Portal's stack, tmux synthesises the answer, and
four surveyed applications detect *by default*. The original "unreliable inside
tmux" objection was against OSC 11 and does not carry over.

**Pairing axis — the evidence is genuinely split, and the two sides are different
kinds of evidence:**

*For paired:*
- **Charm's own direction is the most directly applicable prior art**, because
  Portal is a Lipgloss v2 app. Lipgloss v2 moved `AdaptiveColor` into `compat` and
  de-recommends it — but the recommended replacement is
  `lightDark := lipgloss.LightDark(hasDarkBG)` then `lightDark(lightVal, darkVal)`.
  **Paired values retained; the *detection* made explicit.** Charm de-recommended
  implicit detection, not paired colours. Glamour v2 likewise removed
  `WithAutoStyle()` and told callers to detect themselves. That nuance is easy to
  flatten into "Charm abandoned adaptive colours", which is not what happened.
- tmux 3.8 adopting paired slots — but weaker than it first appears: tmux's slots
  are *ANSI colour families* (`themeblack`), which structurally must pair because
  one slot means "black" in both modes. Portal's tokens are semantic roles. The
  analogy is looser than the surface similarity suggests.
- Zero migration; theme identity stays stable across an auto flip.

*For split:*
- Single-palette is overwhelmingly dominant across ~20 surveyed tools.
- **The "missing variant" problem simply ceases to exist.** The deep dive's own
  assessment: the ecosystem never answers "what if a theme defines only one
  variant?" because single-palette means there is never a missing variant. Every
  tool needing both refers to *two theme names*.
- **The authoring burden, which is the Portal-specific argument and the strongest
  one.** Paired means a theme author supplies 40 values (20 tokens × 2 modes) and
  clears contrast floors against *two* canvases. Split means 20 values against one.
  Portal's own history is the evidence for how real that cost is: MV's light
  variants needed six individual erratum corrections plus three eyeball-pinned
  surface tints *by the maintainer who designed the palette*.
- Collapses `theme.Mode`, `Token.ColorFor`, and mode-threading through ~20 files.

### The decision criterion this suggests

The pairing choice turns less on which is "more modern" and more on **who writes
themes**:

- If themes are curated built-ins Lee authors, paired costs little — he does the
  two-mode tuning either way, and theme identity stays stable across an auto flip.
- If a **user theme ecosystem** is wanted, paired doubles both the authoring burden
  and the contrast-tuning burden, and every surveyed tool with a real theme
  ecosystem went single-palette.

That question — is this a curated set or a user ecosystem? — is upstream of the
pairing decision and has not been asked in this session.

## Decomposition: three questions, only two of them independent

The session kept flip-flopping on "remove the appearance axis or not" because that
was treated as its own decision when it is partly *downstream* of another. Breaking
it into the three questions actually in play:

**Q1 — Does Portal detect the terminal's light/dark preference at all?**
Independent. Answerable on evidence: viable now (mode 2031 verified present in
Portal's stack; tmux synthesises the answer; four surveyed tools detect by default).

**Q2 — Is a theme one palette, or a light/dark pair?**
Independent. This is the paired-vs-split question.

**Q3 — Is there a user override on detection, and what does it look like?**
**Not independent — its *shape* is determined by Q2.** This is the one the session
has been calling "the appearance axis", and it is why the question kept resisting a
clean answer.

### Why Q3 is derived

`prefs.appearance = auto|light|dark` is not "the detection". It is the **override on**
the detection — `auto` means *use* the detected answer, `light`/`dark` mean *ignore*
it and force this. What that override looks like depends entirely on Q2:

- **Under paired**, detection picks a *variant inside* the selected theme. An
  override therefore has to be a separate mode enum, because there is no other way
  to say "give me MV's light variant even though my terminal is dark". That enum is
  exactly today's `auto|light|dark`. **Paired keeps the appearance setting.**
- **Under split**, detection picks *between two named themes*. The override is not a
  mode enum — it is the **shape of the theme setting itself**. Helix's design is
  precisely this: `Config::Constant(String)` vs
  `Config::Adaptive{light, dark, fallback}`. Writing `theme = "tokyo-night-dark"`
  *is* the pin (a constant theme, no detection); writing `dark = "…" / light = "…"`
  opts into detection. There is no `appearance` enum anywhere.
  **Split dissolves the appearance setting into the theme setting.**

So the answer to "are we keeping or removing auto/light/dark" is: **it is not a
standalone choice.** Choosing split removes it as a *consequence*; choosing paired
keeps it. The only genuinely free part is whether `auto` is among its values, which
is Q1.

### The four combinations, made concrete

What the user's config actually looks like in each:

- **Paired + detect** (today's design, now on a working detection mechanism) —
  `theme = "modern-vivid"` + `appearance = auto|light|dark`. One theme identity that
  survives a light/dark flip.
- **Paired + no detect** — `theme = "modern-vivid"` + `appearance = light|dark`.
  Same model, the `auto` value simply removed.
- **Split + detect** (Helix's design) — `theme = { dark = "tokyo-night-dark", light
  = "tokyo-night-light", fallback = "tokyo-night-dark" }`. No appearance setting.
- **Split + no detect** (the most common shape in the wild) —
  `theme = "tokyo-night-dark"`. One line, nothing else.

Note that the last two are the *same setting* in two shapes, which is what makes
Helix's design tidy: a user who doesn't care writes one theme name and never learns
the adaptive form exists.

### What this means for sequencing the discussion

Q1 and Q2 are the real decisions. Q3 falls out. And Q2 has the curated-set vs
user-ecosystem question upstream of it (see above), which is the genuinely unasked
one.

## What detection would actually DO under the split model

Lee is leaning split, chiefly on authoring burden, and asks the right follow-up:
under split, what is `auto` even for? His guess was "just the initial startup" —
that is one of two jobs, and the smaller one.

### Job 1 — Seed the default for an unconfigured user (one-shot)

Portal ships a default theme. On a first run with nothing configured, detection can
start on the light built-in instead of the dark one. Applies only while the user has
configured *nothing*; the moment they choose, it never runs again. This is the job
described earlier in this file.

### Job 2 — Follow the terminal, continuously (ongoing, push-driven)

This is the one the earlier "first-run seed" framing missed, and mode 2031 is what
makes it different in kind. 2031 is a **push notification on change**, not a query.
So if the terminal flips light→dark mid-session — macOS appearance following sunset,
or the user switching their Ghostty theme — Portal *receives*
`uv.LightColorSchemeEvent` / `uv.DarkColorSchemeEvent` and can swap to the user's
nominated theme for that mode, live, without a restart. That is Helix's `Adaptive`
config doing its job continuously, not at startup.

Crucially, **Job 2 only has meaning if the user nominated two themes.** Under split:

- `theme = "tokyo-night-dark"` → detection is never consulted. Nothing to choose
  between. No `auto` concept is needed or exposed.
- `theme = { dark = "…", light = "…" }` → detection *is* the chooser, for the
  session's whole life.

So under split, **`auto` is not a setting at all** — it is implied by whether the
user supplied a pair. "Do we need auto?" becomes the cleaner question: *do we
support the adaptive two-theme form?* The two jobs are independently optional —
either, both, or neither.

### The honest counter-case for Job 2

It only pays off for users who genuinely run a light terminal by day and a dark one
by night. It costs the 2031 opt-in, an event path, and a live-swap route — and
Portal is a transient UI by Lee's own earlier reasoning, so a brief mismatch is
cheap. Worth deciding on its own merits rather than inheriting it because detection
happens to be available.

### A related mechanic split needs anyway: how does Portal know a theme's mode?

Under split, Portal must know whether a given theme is a light or a dark one — for
the adaptive pair form, and for a list filter if the selector offers one. Two
options, both with prior art:

- **Derive it.** Because Portal's canvas is *itself a token*, a theme's light/dark
  identity is computable from its own canvas luminance. Ghostty's theme browser does
  exactly this (`shouldIncludeTheme`, Rec.709 coefficients, 0.5 threshold on the
  theme's background). A theme file then declares nothing.
- **Declare it.** base16's common scheme format carries an optional `variant`;
  the newer tinted8 spec makes `variant: dark|light` **required** and adds
  `scheme.family` / `scheme.style` so the sibling relationship is structured rather
  than inferred from the slug.

Derivation is less for an author to get wrong; declaration is more explicit and
survives a theme whose canvas sits near the threshold.

### An interaction to be aware of

If Job 2 ships alongside the slide-over, the two can fight: the user picks a light
theme in the panel while their terminal is dark and their config says
`dark = tokyo-night-dark`. Which wins, and for how long? Helix has prior art — a
manual `:theme x` sets a constant theme for the session, overriding the adaptive
config until restart. Noting the interaction; the resolution is discussion's.

## Terminal vs OS: the session landed on **match the terminal**

Tested live by Lee, with screenshots. He set macOS to light while Ghostty stayed
pinned dark. His shell prompt broke badly — something in the prompt stack followed
the OS and switched to light-appropriate greys while the background stayed dark,
producing washed-out, barely-legible text. **Portal, opened in the same terminal in
the same state, rendered perfectly.**

That comparison is the whole argument in one image. The prompt sets *foreground only*
and inherits a background it does not control, so the moment the two signals disagree
contrast collapses. Portal paints **both** — leaf `.Background(canvas)`, the outer
full-terminal `fillCanvas`, and OSC 11 for the gutter — so it cannot produce a
contrast mismatch whichever signal it follows. Canvas ownership is what bought that.

It also corrects an earlier framing in this document: the cost of following the OS was
described as "a light Portal *inside* a dark terminal". Portal does not sit inside
anything — it covers the window edge to edge. The mismatch is felt only at the
**transition** in and out.

### Why terminal won

1. **Forward compatibility with a possible transparent-background mode — the
   strongest argument, and it inverts an earlier claim in this document.** This file
   previously concluded that if both owned-canvas and transparent themes existed, the
   signal would have to become *per-theme*. That is only true if Portal follows the
   **OS**. Transparent themes *must* follow the terminal background — so if Portal
   already follows the terminal, adding transparency later is **purely additive**: no
   second mechanism, no per-theme signal selection. Choosing terminal now makes the
   deferred transparency decision cheap; choosing OS now makes it expensive.
2. **Portal's dwell time is seconds, so the transition dominates.** Launch → pick →
   exec into a session, many times a day. A Portal matching the terminal reads as
   "your terminal, with a picker in it". A Portal matching the OS against a pinned
   terminal flashes light and drops back to dark, twice per use.
3. **A terminal/OS mismatch is usually deliberate, not stale.** The earlier "the OS is
   the truer preference" argument assumed the mismatch was accidental. Lee's Ghostty
   is *pinned* dark — an explicit choice about the environment Portal lives in. For
   something that lives inside a terminal, the terminal's background is arguably the
   more relevant preference, not the weaker one.

### This retroactively resolves the ambiguous test

The session could not decide whether Lee's original observation (Portal stayed dark
when macOS went light) meant "OSC 11 failed inside tmux" or "the terminal never
changed". He has since confirmed **Ghostty is pinned dark**. So reading #2 is almost
certainly correct: the terminal genuinely *was* dark, Portal correctly read dark, and
**OSC 11 was working the whole time**. The "detection is unreliable inside tmux"
premise — which drove a large part of this session — was probably never true in this
environment.

### What is given up

OSC 11 is **query-only**; mode 2031 pushes on change. So following the terminal gives
*correct-at-startup* but not *live-following* — both signals need a startup query, but
only 2031 can tell Portal the answer changed later. In practice thin: terminal
backgrounds rarely change mid-session, and when they do it is usually because the
terminal is itself following the OS.

## Transparency: deferred, not rejected

Lee's case for it, recorded because it is good: the original contrast strictness
existed **because there was exactly one theme** — if Portal's single palette clashed
with a user's terminal, Portal was unusable and there was no alternative. With a
*library*, "that theme doesn't suit my terminal, I'll pick another" is a perfectly
normal answer, and it is how the ecosystem already behaves — k9s does not own the
background, some of its skins clash with Lee's off-grey Nord-ish terminal, and the
answer is simply to use a different skin. Under transparency, matching becomes the
*user's* job via theme choice, which is the benefit.

Deferred until there are enough themes for the question to be real. Deferring is now
cheap precisely because of the terminal-signal decision above — a transparent theme
needs no new detection mechanism.

**Feasibility, verified.** The plumbing already exists: `NO_COLOR` is exactly this
mode. Canvas ownership lives in three places (leaf `.Background(canvas)`, the outer
`fillCanvas`, OSC 11) and all three are already suppressed under the carve-out.
The obstacle is that **one boolean does two jobs** — `header.go:87`'s `colourless`
branch returns a bare style, dropping *both* hue and canvas. A transparent theme wants
the `Foreground` kept and the `Background` dropped, so the change is splitting
`colourless` into independent no-hue / no-canvas flags and threading the second.
Prior art: btop's `theme[main_bg]` empty-for-terminal-default plus its separate
`theme_background` opt-out.

**Costs if it ever ships** (recorded so they are not rediscovered): validation becomes
bimodal — Portal's floors, bands, ceilings and fill-perceptibility thresholds are all
computed against exact canvas hexes and cannot be evaluated for a transparent theme;
and the slide-over needs the panel to opt *back into* a background to stay readable
over arbitrary content beneath it.

## Attribution for ported themes — settled in session

Ported palettes (Nord, Dracula, Catppuccin, Rose Pine, Tokyo Night …) are separately
licensed works, and Portal ships as a distributed Homebrew binary, so redistribution
carries an attribution obligation. **Lee's position: attribution lives in the
repository — documentation and the GitHub README — and explicitly NOT in the UI.**
No in-app attribution surface, no credits screen, nothing in the slide-over.

Secondary and unresolved-by-omission: the *naming* question. A port is a remapping of
a 16-slot palette onto 20 semantic roles with tokens adjusted to clear floors, so
calling the result "Nord" is a claim about a modified thing. Some upstream projects
publish porting guidelines for exactly this. Not treated as a blocker.

## Theme validity — settled in session

**One rule: a theme is listed only if all 20 tokens are present AND every value is
syntactically well-formed.** Anything else is rejected with a single failure mode and
a single message. Explicitly NOT checked: whether the colours are good, readable,
mutually distinguishable, or clear any contrast floor — an all-black but well-formed
theme is valid and gets listed. The check is *syntactic*, never perceptual.

Rejection surfaces as a flash/banner, and Lee's instinct is that it belongs **inside
the slide-over** rather than the main UI — it is a message about the thing you are
looking at, and it avoids adding a seventh contender to the notice-band arbiter's
already-crowded precedence chain (filter line → burst progress → transient flash →
multi-select banner → unsupported banner → no-tags signpost).

### Why Portal must own the parse

`lipgloss.Color` **never returns an error** and its accepted domain is wider and
stranger than a theme format wants (`color.go:68`):

```go
if strings.HasPrefix(s, "#") { c, err := parseHex(s); if err != nil { return noColor }; return c }
i, err := strconv.Atoi(s); if err != nil { return noColor }
if i < 0 { i = -i }                      // negatives silently abs'd
if i < 16 { return ansi.BasicColor(i) }
if i < 256 { return ANSIColor(i) }
r, g, b := uint8((i>>16)&0xff), ...      // >=256 reinterpreted as packed RGB
```

So `"212"` is a valid ANSI-256 index, `"-5"` becomes `5`, `"16777215"` silently
becomes white, and every failure is the silent `noColor` sentinel. Portal therefore
owns a small validator (regex + range test) rather than leaning on lipgloss — which
also lets it report *"theme `nord`: `text.primary` = `#GGGGGG` is not a valid
colour"* instead of a bare boolean.

**Open, and the actual decision here: what value domain does a Portal theme accept?**
Hex only? Hex plus ANSI index (which `Token`'s own doc comment already sanctions)?
Everything else follows from that. Bonus: the parse-to-RGB it requires is exactly what
a contrast check would need if floors ever return for any class of theme.

## Swap cost: the cheap path already exists and already excludes the expensive one

Lee's ask: while the slide-over is open, a theme change should take the shortest path
to updating colours on screen, with any heavier work deferred to panel exit.

**Verified: that split already exists in the code, and no deferral is needed.**

- **Restyle** — `applyCanvasMode` swaps the delegate and re-points the cached style
  structs `bubbles/list` holds (help styles, pagination dots, TitleBar, both filter
  inputs, then the same again for Projects). O(1), no I/O, no list content touched.
- **Rebuild** — `rebuildSessionList` re-derives the item list and, in grouped modes,
  runs the lazy dir-resolution pass with its per-session tmux pane reads (the known
  ~0.5s By-Project switch cost at ~38 sessions).

**`applyCanvasMode` does not call `rebuildSessionList`.** The cheap path already
excludes the expensive one and is already exercised in production — it is what runs
whenever the OSC 11 reply lands after first paint.

**Correction to the premise:** "without re-rendering the screen" is not a target,
because the re-render is not the cost. Bubble Tea rebuilds the whole view string on
*every* keypress regardless, diffs it against the previous frame, and writes only
changed cells — holding the down arrow in the sessions list already does this dozens
of times a second. A theme swap costs one ordinary keypress plus the style re-point.

**So "bake in on exit" is unnecessary, and would be worse** — nothing is left
un-baked, and deferring work to panel close would create a visible discontinuity at
the one moment that should be seamless.

**The real risk is completeness, not speed.** The restyle path is a hand-maintained
list of cached-style sites with **no guard test** enforcing that new ones are added
(unlike the colour-literal rule, which has an AST glob guard). Miss a site and that
element silently keeps the previous theme's colours until something else re-renders
it. Also outstanding: `pagepreview.go:35`'s init-time `Token` copy, and the fact that
init-time copies of *derived styles* were never swept for.

## Token rename scope — the audit content, and Lee's leaning

Raised in session and not otherwise captured. The rename was logged against the two
border tokens, but the *whole* 20-token vocabulary becomes the public contract, and
applying the file's own test — intrinsic name or use-site name? — to the rest turns up
three things:

- **`bg.track` is named after the loading bar's empty track.** Its own comment says
  so. Use-site-derived by exactly the standard that condemned `border.footer`.
- **`text.on-selection` and `text.on-warning` are pairing names pointing at *other
  tokens*.** That is Crush's `onPrimary` convention (A8), so it is defensible — but it
  means renaming `bg.selection` or `bg.warning` strands two other names. There is
  coupling *inside* the vocabulary that a two-token rename would not surface.
- **The ramp `text.muted-bright` → `text.detail` → `text.dim` → `text.faint` encodes
  no ordering in its names.** A theme author cannot tell from the names which is
  brighter. That is precisely what A8's prior art solves — Crush's
  `fgSubtle`/`fgMoreSubtle`/`fgMostSubtle`, and base16's rule that `base00`→`base07`
  must run dark-to-light.

**Lee's leaning (stated, not confirmed):** *"maybe I was wrong to suggest that … there's
only 20 tokens, so maybe it's not that difficult"* — i.e. toward a **full 20-token
audit** rather than the two-token rename as originally logged. Recorded as a leaning;
the scope decision belongs to discussion.

Still absent either way, and needed before naming can be settled: a statement of what
the two border tokens' **intrinsic roles actually are** (the identical light hex is
evidence they may be one role, not two — see B6), and any candidate naming scheme for
Portal.

## Slide-over: search and filtering deferred (YAGNI)

Lee: no search or filtering in the panel for now — themes will be added over time, not
in bulk, so it is a YAGNI until the library is large enough to warrant it.

**The tripwire is worth recording, and it is later than first framed.** In session it
was suggested that the pressure comes from the light/dark *mix* rather than the raw
count — a user in a dark terminal applying a light theme every second row on the way
past. Lee's correction: not every theme will have both, and the well-known palettes
skew heavily dark (A3 — only six sibling pairs among Zellij's 41 built-ins; Dracula
and Nord are dark-only). So a Portal library built from famous palettes would be mostly
dark with a handful of light ones, and the interleaving problem arrives later than a
50/50 split would imply.

Both closest analogues do solve it when the library grows (A9): kitty's themes kitten
has fuzzy search plus a recently-used list; Ghostty's `+list-themes` has fuzzy search
and an `f` key cycling `all → dark → light`.

**Also raised and self-answered:** how the panel would let a user set *both* halves of
an adaptive light/dark pair — Lee's own answer was a keybinding or a toggle on the
slide-over selecting which slot you are setting. A design question for discussion, not
a feasibility one; nothing blocks it.

## Convergence flag — threads that have left research territory

Lee called this out mid-session and he is right: the slide-over thread drifted into
deciding rather than exploring. Recording the boundary so the phase doesn't keep
crossing it.

**These are decisions, not findings — they belong to discussion.** They are recorded
above because they were reasoned through here, but they should be re-opened and
ratified in the discussion phase rather than treated as settled by research:

- **Match the terminal background, not the OS colour scheme** (landed late in the
  session, on the transition-dominance and transparency-forward-compatibility
  arguments). Implies OSC 11 stays the mechanism and mode 2031 is not adopted.
- **Owning the canvas is retained; transparency deferred, not rejected.**
- Overlay vs shrink-to-fit for the panel (landed on overlay).
- Apply-on-arrow vs preview-then-commit (landed on apply-on-arrow).
- Persist-on-close vs persist-per-keypress (landed on persist-on-close).
- Marker for the on-open theme; no revert keybinding.
- Whether the appearance axis is removed at all.
- Panel input routing — what `Enter` does while the panel is open, who owns arrows,
  behaviour during an active filter / multi-select / on other pages. **This is
  squarely discussion territory and was wrongly pushed as a research question.**

**The distinction worth holding onto**, because the session blurred it: *"is
light/dark detection reliable inside tmux?"* is a research question — factual,
testable, and it changes what options exist. *"Should Portal remove the appearance
axis?"* is a discussion question. The first informs the second; they are not the
same question, and the session had started treating them as one.

**What remains genuinely unexplored, and is research territory:** the theme-file
format and its dependency cost; the border-token rename and naming prior art; where
an additional built-in theme's values come from and whether an off-the-shelf palette
can clear Portal's floors; what the validation rule set actually is; the
capture-harness cost; and whether detection works in Portal's stack at all.

---

# Appendix: consolidated evidence

Findings from the background review and the ecosystem deep dive, folded in so
discussion inherits them. Organised by subject rather than by finding id. Sources
for every ecosystem claim are in
`.workflows/.cache/theming-system/research/theming-system/`.

## A. Ecosystem evidence (deep dive, ~20 applications + 5 emulators + spec families)

### A1. Detection landscape

- **Application-layer detection is common and often default-ON**: `bat` (`--theme`
  defaults to `auto`), `delta` (`--detect-dark-light` defaults to `auto`), Neovim
  (`'background'` auto-set by the TUI on startup and re-detected whenever a UI
  attaches, unless set explicitly), `yazi` (preset chosen by detection).
- **Where detection is opt-in, the opt-in shape is "name two themes"**, not a
  boolean. Helix's config is a union — `Constant(String)` or
  `Adaptive{light, dark, fallback}`, with `fallback` documented as *"a theme to
  choose when the terminal did not declare either light or dark mode"*, defaulting
  to the dark one. Zellij requires `theme_dark` **and** `theme_light`; set only one
  and the static `theme` stays authoritative.
- **Dark is the universal no-answer fallback** — Helix, Neovim, delta, Glamour v2.
- **The emulator layer answers a different question**: it tracks the *OS* appearance,
  not the terminal's colours. Ghostty's `theme = light:X,dark:Y` is explicitly
  *"based on the current desktop environment theme"*. kitty models **three** OS
  states (`dark-theme.auto.conf` / `light-theme.auto.conf` /
  `no-preference-theme.auto.conf`). iTerm2 is a checkbox; WezTerm is a documented
  Lua recipe; Alacritty has nothing native.

### A2. Charm's own direction (most directly applicable — Portal is a Lipgloss v2 app)

Glamour v2 **removed** `WithAutoStyle()` outright, defaulting to `"dark"`. Lipgloss
v2 moved `AdaptiveColor` into `compat` with the rationale that implicit detection
*"removes the purity from Lip Gloss… removes transparency around when I/O happens"*.
**But the recommended replacement keeps paired values and makes detection explicit**:
`lightDark := lipgloss.LightDark(hasDarkBG)` then `lightDark(lightVal, darkVal)`.
Charm de-recommended implicit *detection*, not paired *colours* — a nuance that is
easy to flatten into "Charm abandoned adaptive colours", which is not what happened.

### A3. Pairing: five distinct ways the ecosystem expresses light↔dark

A theme is overwhelmingly **one palette**; siblings are separate themes. Where the
pairing lives varies:

1. **Naming convention only** (most common, most fragile) — Zellij's 41 built-ins
   include `ayu-`, `everforest-`, `gruvbox-`, `iceberg-`, `solarized-`,
   `tokyo-night-` `-dark`/`-light` pairs. delta actually *parses* it:
   `is_light_syntax_theme()` returns true if the name `.contains("light")`.
2. **Two config settings** — Helix `[theme] dark=/light=/fallback=`; Zellij
   `theme_dark`/`theme_light`; bat `--theme-dark`/`--theme-light`; yazi
   `[flavor] dark=/light=`; kitty's three `.auto.conf` files.
3. **One setting, inline mapping** — Ghostty's `theme = light:X,dark:Y`, both halves
   mandatory in that form.
4. **Metadata inside the palette** — base16's optional `variant`; **tinted8** makes
   `variant: dark|light` *required* and adds `scheme.family` (e.g. "Tokyo") +
   `scheme.style` (e.g. "Night", "Moon"), replacing the naming convention with
   structure. **No spec in the family carries a pointer to its sibling.**
5. **Derived from the palette itself** — Ghostty's theme browser classifies every
   theme by the relative luminance of the theme's own background (Rec.709
   coefficients, 0.5 threshold). If a theme owns its background, its light/dark
   identity is computable and need not be declared.

**Counter-evidence for paired**: tmux master (3.8, **unreleased**) adds a `theme
[detect|terminal|light|dark]` option plus two parallel sets of ten slots
(`dark-theme-black`… / `light-theme-black`…) resolved to one usable name
(`themeblack`) — structurally Portal's current model, though the slots are ANSI
colour families rather than semantic roles.

**Cardinality note (session finding)**: paired assumes 1:1. Real families are not —
Catppuccin is one light (Latte) and three darks; Dracula and Nord are dark-only;
Zellij's 41 built-ins contain only six sibling pairs, leaving 29 single-mode themes.
k9s pairs `rose-pine.yaml` with `rose-pine-dawn.yaml` — the sibling isn't even named
`-light`.

### A4. Defaults and first run

**No terminal application surveyed prompts on first run.** Every one ships a
hardcoded default and starts rendering. The single counter-example found in the
wider ecosystem is **Powerlevel10k**, whose wizard auto-launches on first shell
startup and renders a live preview per option — but it can do that because its
"first run" is unambiguously an interactive shell with a terminal attached and its
output surface is a prompt it is already drawing. Both properties are the inverse of
Portal's situation.

### A5. A fourth strategy Portal has already rejected by owning a canvas

Several tools sidestep light/dark entirely by **inheriting the terminal's ANSI
palette**: lazygit's whole default theme is ANSI names (`[green, bold]`,
`[default]`); gitui's `Default for Theme` is `Color::Reset`/`Color::White`/…;
fzf's `--color=16`/`bw`; Helix ships `base16_default`; tmux master names it
`theme terminal`. btop is the only surveyed tool offering *both* — a hex theme plus
`theme_background = false` to opt out of owning the background. The trade is
legibility guarantees for palette control. Portal's canvas ownership is the
deliberate opposite choice; worth knowing the road not taken is a real one.

### A6. File format

**No consensus whatsoever** — each tool uses whatever its config already used:
Helix TOML (114–194 lines), k9s YAML (114, with YAML anchors for dedup), Zellij KDL
(124), btop flat `key="value"` (41), atuin TOML (2–10, partial by design), gitui RON
(2–21, partial by design), Glamour JSON, base16/tinted8 YAML (~20), fzf a single CLI
string. **Ghostty and kitty avoid inventing a format at all — a theme *is* a config
file** (with a documented security caveat in Ghostty's case: a theme can set any
config option, so don't use untrusted ones).

**Partial-merge-over-a-base is the clear modern direction**, and gitui migrated to
it deliberately: *"you don't have to specify the full theme anymore (as of 0.23)"*.
atuin chains via `parent = "autumn"` with a `max_depth = 10` guard; Helix has
`inherits`; yazi merges user `theme.toml` over the flavor; Ghostty lets later keys
override the theme. **Note for Portal: atuin and Helix both let the user pick *which*
base — so merge-over-default and selectable-base are the same feature, not competing
ones.**

**Library and selection are separated almost universally**: themes live in
`~/.config/<tool>/themes|skins|flavors/`, selection is one line in the main config.
Two-tier search (user dir shadows shipped dir) is standard; Helix reserves `default`
and `base16_default` as unshadowable. And **both GUI-adjacent pickers write to a
machine-owned file rather than editing the user's config** — kitty copies to
`current-theme.conf` and injects an `include`; Ghostty writes `theme = <name>` into
`auto/theme.ghostty`.

### A7. Token vocabularies

Counts run **8 to ~105**: atuin 8 (semantic), lazygit 12 (all use-site), base16 16
(ANSI-slot), gitui 21, base24 24, Crush ~34, btop 41, k9s ~50, Zellij 14 components
× 6 slots, Helix ~105 keys (53 of them `ui.*`).

**Use-site naming is the norm, not the exception** — Helix, the most sophisticated
system surveyed, names essentially its whole UI half by use-site (`ui.statusline`,
`ui.bufferline.active`, `ui.popup.info`, `ui.menu.selected`). So Portal's
`border.separator` / `border.footer` are not anomalous by ecosystem standards; they
are the majority convention.

**Two-layer structure is common**: an arbitrary-named palette underneath, named
roles on top. Helix's default declares `[palette] white/lilac/lavender/comet/
bossanova/midnight/…` — poetic names with no semantics — then binds scopes to them.
Starship goes furthest: no fixed vocabulary at all, users name their own colours.

### A8. Prior art for weight-based naming (directly relevant to the border rename)

**Charm's Crush** is the best example, and it is a Bubble Tea application:

```go
// Low-contrast dividers, separators, and rule lines.
separator color.Color

fgSubtle     color.Color
fgMoreSubtle color.Color
fgMostSubtle color.Color

// Contrast pairings: foregrounds designed to sit on top of a matching background role.
onPrimary color.Color

bgMostVisible  color.Color
bgLessVisible  color.Color
bgLeastVisible color.Color
```

The convention is **comparative/superlative ladders encoding intrinsic prominence**,
and `separator` is defined *intrinsically* — "low-contrast dividers, separators, and
rule lines" — rather than by where it appears. `onPrimary` is documented as a
*contrast pairing*, which is the same concept Portal's `contrast_test.go` encodes
implicitly. **Caveats**: Crush is not user-themeable (themes are Go functions) and
has no light/dark handling at all — so this is internal-vocabulary prior art, not a
public contract.

Two others: Zellij's two-axis scheme (component = use-site, slot = intrinsic weight
`base`/`background`/`emphasis_0..3`); and base16's ordering *rule* —
`base00`→`base07` must range dark-to-light — which is what lets one slot name serve
both modes ("position on the prominence ramp", not "this colour").

### A9. Live switching and preview — three mechanisms, all shipping

- **In-app command with live preview (closest analogue to the slide-over)** — Helix
  `:theme <name>` re-themes without restart, and the completion prompt implements a
  clean **three-state** model: `Update` → preview, `Abort` → revert,
  `Validate` → commit. It also gates on capability, refusing a truecolor theme on a
  non-truecolor terminal.
- **Config-file watch** — Zellij (*"picks up changes in real time, you will not have
  to restart"*), Alacritty (`live_config_reload`), and **k9s, which is the most
  directly relevant because it's Go**: `fsnotify` on the skins directory, reacting
  only to the *active* skin, with a **listener pattern notifying UI components of
  theme changes** — i.e. exactly the "re-point the cached leaf styles" operation
  `applyCanvasMode` already performs.
- **External picker + reload signal** — kitty's `kitten themes` (live preview, fuzzy
  search, recently-used list) and **Ghostty's `+list-themes`, whose layout is what
  Portal is contemplating: theme list on the left, live preview pane on the right**,
  fuzzy search, `F1` help, `Esc` to exit, and an `f` key cycling the light/dark
  filter (`all → dark → light`). It also re-themes its own chrome live off
  colour-scheme events — a mid-session flip handled as routine, not special-cased.

### A10. Contrast validation is essentially absent from the ecosystem

**No terminal application surveyed validates user colours for contrast** — not at
load, not ever. The only in-band mechanism found anywhere is **Ghostty's
`minimum-contrast`**: real WCAG 2.0 ratios, but a **clamp** applied per rendered
cell at draw time, **off by default** (`1` = no constraint), and it demonstrates the
clamp failure mode — pushing foreground toward black or white destroys the theme's
hue at the point it engages.

What validation exists elsewhere is structural, not perceptual: Helix's
`cargo xtask themelint` checks *completeness* (missing scopes), and its
`is_16_color()` check refuses truecolor themes on incapable terminals — real
validation, wrong axis. atuin's `debug = true` warns on unparseable colours.
**Neither base16 nor tinted8 imposes any contrast requirement**; base16's
dark-to-light ordering is an unenforced guideline. External tooling exists
(WCAG-Terminal-Checker — report-only; dank16 — solves it at *generation* time) but
sits outside the tools.

**Portal's existing numerically-verified floor against exact canvas hexes appears to
be more rigorous than anything in the surveyed ecosystem, including the specs.**

## B. Portal-specific gaps and corrections (background review)

### B1. Corrections to claims made during this session

- **`prefs.Appearance` has 7 non-test consumers**, not one: `cmd/open.go`,
  `cmd/capturetool/main.go`, `internal/prefs/store.go`, `internal/capture/swatch.go`,
  `internal/tui/build.go`, `internal/tui/appearance_gate.go`, `internal/tui/model.go`.
  The **capture harness is a second independent consumer** the session did not know
  about.
- **14 files reference `prefs.Appearance`/`WithAppearance`/`Load|SaveAppearance`**,
  not "two dedicated plus ~8". Widening to the canvas-mode surface reaches 28 test
  files.
- **`SaveAppearance` has no production caller today** — `cmd/open.go` only *loads*
  it. Appearance is currently read-only in production, so a slide-over would be its
  first writer.
- **The live-swap site enumeration was incomplete.** Beyond delegates, list help
  styles, pagination dots and the outer fill, `applyCanvasMode` also re-points
  `styleFilterInput`/`styleListFilterInput` and TitleBar backgrounds. There is **no
  guard test** enforcing that future cached styles get added there (unlike the
  colour-literal rule, which has an AST glob guard). The `pagepreview.go:35` sweep
  found init-time copies of *`Token` values*; init-time copies of *derived styles*
  were not swept for.
- **The colour-literal guard is narrower than the invariant it implies**: it flags
  only a `BasicLit` argument to `lipgloss.Color` within the `internal/tui` package
  directory. It does not see `lipgloss.ANSIColor`, struct-literal colour types,
  colours arriving from dependency defaults, or anything in `internal/capture`.
  Dependency-owned colour is handled ad hoc — `applyCanvasMode` strips the
  `bubbles/list` default Title box only on the colourless branch.

### B2. The validation rule set is richer than "floors plus a pairing table"

`contrast_test.go` has 14 test functions encoding more than floors:

- **Two-sided bands, not floors.** `text.dim` must clear 3:1 **and must not reach
  4.5** ("that would mean it is no longer de-emphasised"). `text.faint` is **exempt**
  from the floor but must sit above 1:1 **and strictly below 3:1** — a ceiling. A
  floor-only validator would accept themes the current suite rejects.
- **A non-contrast threshold**: `floorFillPerceptible = 1.1` governs tint fills.
- **Three tokens are explicitly not numerically checkable** —
  `TestLightSurfaceTintsPinned` exists because light-tint-on-light-canvas is
  "numeric-insufficient", confirmed by human eyeball at a gate.
- Plus pair rules for `bg.selection` / `bg.warning` / `bg.track`, foreground-on-tint
  pairings, the inline flash, and the preview peek chrome.

**Nothing checks that semantically distinct tokens stay distinguishable from *each
other*** — `state.green` vs `state.red` (attached vs kill), `accent.violet` vs
`accent.blue` (cursor vs key hints). A theme where both clear the floor and equal
each other passes every rule contemplated. Portal's glyph-backed state design is the
existing mitigation.

**Also unexamined**: a floor validated on a truecolor hex says nothing about the
colour actually painted after `lipgloss`/`colorprofile` downsamples on a 256- or
16-colour terminal — the validator would measure the requested value, not the
painted one.

### B3. Theme file: integration surface

- **No YAML or TOML direct dependency in `go.mod`** — every config today is stdlib
  `encoding/json` (`projects.json`, `hooks.json`, `prefs.json`, `terminals.json`)
  plus one flat `key=value` file (`aliases`). YAML/TOML adds a third-party parser to
  a codebase that has avoided one for config.
- **`terminals.json` is the closest precedent**, not `prefs.json`: user-authored,
  read-only at load, own env var, loaded once at construction, documented in
  `docs/custom-terminals.md`, mapped to the **empty log component** because
  "terminals" isn't in the closed component vocabulary. A themes file inherits that
  last property — **which constrains where a validation warning could be emitted**.
- `cmd/config.go`'s `configFilePath`, `migrateConfigFile` and `configFileComponents`
  each need an entry.

### B4. Theme identity and discovery (largely unexplored)

Single file vs a `themes/` directory; slug vs display name (the persisted value is a
durable identifier); collision between a user theme and a built-in name; **what
renders when the persisted theme no longer exists on disk** — the tolerant-decode
pattern used for the `Appearance`/`SessionListMode` enums does not transfer to an
open string; whether the file is re-read on launch only or reloadable; how a theme
author iterates (note `internal/capture`'s `contrast-validation-{dark,light}` swatch
fixture is already a token sheet that could serve authoring).

**Surfaces outside the TUI, none considered**: a `--theme` flag (the *reversed*
earlier stance named exactly that), a `portal theme list`/scaffold verb, a
`portal doctor` health-check line for an invalid theme file (doctor is the
established config-health surface), and the seed's own "documented token vocabulary"
deliverable.

### B5. Capture harness

`testdata/vhs/` holds **43 tapes** with committed reference PNGs, **9 of them
`-light` pairs**, including a dedicated `contrast-validation-{dark,light}` swatch
pair rendered from `theme.MV` via `internal/capture/swatch.go`. `internal/capture`
is import-guarded to read **no real config** and pins appearance by injecting
`prefs.Appearance` through `tui.Build` — **the exact mechanism this work removes**.
So a config-loaded theme needs an equivalent injection option in
`tui.Build`/`capture.Fixture*` plus a `capturetool --theme` flag, or the harness can
only ever capture the compiled-in default. A themes × fixtures matrix is a real
per-theme maintenance cost against a harness already recorded as flaky-on-write.

### B6. Border rename: evidence the values themselves raise

`BorderSeparator` and `BorderFooter` carry an **identical Light hex** (`#C9CDDB`)
and differ only in Dark (`#292E42` vs `#20232E`). Whether these are two roles or one
role with a weight variant is a question the values raise on their own — and it
bears on the naming *and* on whether the vocabulary should consolidate. The `Name`
strings are already consumed by `All()`, `TestMVDarkVariantsPinned` and
`contrast_test.go` table names, so a rename has mechanical footprint before any user
file exists.

Related, unasked: **how does a token vocabulary evolve once it is a public
contract?** Adding a 21st token runs into `TestMVTokenCount`'s exact-20 pin. Nothing
surveyed had an application-scale versioning story; the only mechanisms found were
ecosystem-scale (base16's compatibility branches, tinted8's required
`scheme.supports.styling-spec` version field).

### B7. Other open threads carried forward

- **Documented-behaviour removal**: `appearance` is described in `README.md` at four
  places (`:83`, `:266`, `:379`, and a dedicated paragraph at `:385` recommending
  users pin it *"when auto-detection misfires (for example under tmux
  passthrough)"*). That advice is now doubly obsolete and the removal has README /
  CHANGELOG / user-expectation consequences.
- **Startup cost is unbudgeted**: the removal argument counts the 50ms first-paint
  wait as a win while adding a config read, parse and multi-rule validation sweep to
  every launch, in a codebase whose cold path is explicitly latency-engineered.
- **Persistence seam**: the existing `ModePersister` interface (injected via
  `build.go`, deliberately **nil** in capture fixtures so an `s`-toggle during a
  capture writes nowhere) is the precedent a theme persister would follow. Also
  unexamined: what two concurrently-running Portal windows do with a mid-session
  change.
- **Merge-over-base has a twist**: the canvas is itself a token, so a partial theme
  supplying a canvas but inheriting `text.primary` from a base leaves the inherited
  token measured against a background it was never tuned for. Which base a merge
  resolves against (MV always? the selected theme? the same-mode built-in?) is
  unstated.
- **`NO_COLOR`**: a theme selector previews nothing under it. Portal has an existing
  precedent for proactively blocking a walkable dead-end affordance — multi-select
  `m` is blocked at entry on an unsupported terminal, with a flash and a help-row
  filter.
- **Slide-over specifics not covered**: which key opens it against the taken set
  (`/ s x m k d e r ? Space Enter Esc`), behaviour during an active filter, in
  multi-select mode, and on the Projects and Preview pages; and alternative
  live-preview shapes (bottom band, half-height overlay, previewing on a synthetic
  sample screen — which the `contrast-validation` swatch fixture essentially already
  is).

## Open Questions

### Dissolved during the session (recorded so they aren't re-opened by accident)

- *Must a user theme supply both Light and Dark variants?* — moot under the split
  model the session converged on: a theme is one palette, so there is never a
  missing variant. The deep dive names this as the strongest structural argument
  for split.
- *How do the theme name and the `appearance` pref compose in the selector?* — moot:
  under split there is no `appearance` pref; the override is the *shape* of the
  theme setting (one name, or a light/dark pair).
- *Is live re-theming technically achievable?* (parked by discovery) — **yes**,
  verified: render-time token resolution plus the existing `applyCanvasMode`
  restyle precedent.
- *Does light/dark detection work inside tmux?* — **yes** via DEC mode 2031, verified
  present end-to-end in Portal's dependency stack (behavioural confirmation in a
  live terminal still outstanding).

### Carried into discussion

- Is a theme a *full replacement* or a *merge over a base* — and if merge, which
  base? Complicated by the canvas being itself a token: a partial theme supplying a
  canvas but inheriting foregrounds leaves those measured against a background they
  were never tuned for. Note the ecosystem treats merge-over-default and
  selectable-base as the *same* feature (atuin `parent`, Helix `inherits`).
- Does validation **warn**, **clamp**, or do nothing for user colours? (Lee's
  position in session: not Portal's problem — the strict floor was for MV, the theme
  Portal designs. Floors are MV-specific in code already, so this is consistent.)
- Does the theme file define one theme or many, and does a user theme shadow a
  built-in of the same name?
- Do detection's two jobs ship — the one-shot default seed, and the ongoing
  "follow the terminal" pair form? Independently optional.
- The border-token names, and whether the two border tokens are one role or two
  (identical light hex).
- Everything in Appendix B — the Portal-specific integration surface.

### Genuinely still research (small, deferred by agreement)

- Does any surface render both border tokens together in a way that *requires* them
  to differ? If nothing does, that is evidence they are one role.
- Behavioural confirmation that mode 2031 fires through Ghostty → tmux 3.7b →
  Portal. The code path is verified; the event has not been watched.

## Triage

(none)
