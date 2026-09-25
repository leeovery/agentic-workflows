# Discussion: Theming System

## Context

Portal's TUI is already tokenised: `internal/tui/theme` holds ~20 semantic role
tokens (`Token{Name, Light, Dark}`), every renderer references a token rather
than raw hex, and `theme.MV` is the single built-in "Modern Vivid" palette. The
layout is fixed; only the colour layer is parameterised. So this work is not
building a theming system from nothing — it is changing **where token values
come from** and adding **a surface to switch them**.

Four deliverables arrived together from two inbox ideas taken as one feature:

- Load token values from config rather than code (user-overridable themes).
- Ship at least one additional built-in theme so Portal launches with genuine
  options, not a single palette.
- Add an in-app theme selector with live preview — Lee's picture is a TUI
  "slide-over" overlaying the right-hand strip, arrowing the list re-theming the
  main view live behind it (a modal blanks the screen to the canvas, so a modal
  picker has nothing to preview against).
- Settle the border token names (`border.separator` / `border.footer` — named
  after their first use-site, not their intrinsic weight) **before** the token
  names become the public contract a user themes against.

Research is complete and unusually decisive on feasibility. Live re-theming
works: call sites resolve tokens at render time, and `applyCanvasMode` already
performs exactly the mid-session restyle a theme swap needs. The non-blanking
right-hand overlay already ships (`overlayHelpOnPreview`, lipgloss v2
`Compositor` with real z-layers). Detection works both ways — OSC 11 (terminal
background) and DEC mode 2031 (OS colour scheme) are both plumbed end-to-end in
Portal's dependency stack.

What research deliberately did *not* settle is the decision set. It flagged its
own convergence — several threads landed on positions that belong to this phase
to ratify or overturn, not to inherit as settled.

> **Normative note on the token count.** The vocabulary is **19 tokens**. It was
> 20 for most of this session; the border-token consolidation (see *Token
> vocabulary & rename*) dropped `border.footer`, taking it to 19. Sections
> written before that decision describe the 20-token state — where they state a
> *rule* they have been corrected to 19; where they describe *today's code* (which
> still has 20) they are left as they are. **19 governs.**

### References

- [Research](../research/theming-system.md) — including Appendix A (ecosystem
  evidence: ~20 applications, 5 emulators, spec families) and Appendix B
  (Portal-specific integration surface and corrections)
- [Seed: user-overridable theme system](../seeds/2026-06-17-user-overridable-theme-system.md)
- [Seed: border token role names](../seeds/2026-06-21-border-token-role-names.md)
- [Prior discussion: spectrum-tui-design](../../spectrum-tui-design/discussion/spectrum-tui-design.md) — the "Theming system" section pre-scoped this work

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. Not every subtopic needs its own section — minor items resolved in passing can be folded into their parent. The Discussion Map (which subtopics exist and their states) lives in the manifest, not this file.*

---

## Theme audience — curated set, with two contribution routes

### Context

Research flagged this as the genuinely unasked question, and it sits upstream of
several others: *who writes Portal themes?* The answer sets how much the token
names matter as a public contract, how much documentation and error-message
polish a theme file needs, and — via authoring burden — it bears on the
paired-vs-split theme model.

Two poles were put on the table:

**A — Curated set, config as escape hatch.** Lee authors everything that ships;
the loader exists so a determined user can drop one in. Token names barely
matter, docs are a README table, paired light/dark costs little because Lee
tunes both halves anyway.

**B — Theme ecosystem.** Strangers write and share themes. Token names become a
versioned public contract with an evolution story, error messages must serve
someone who has never read the code, and paired doubles an outsider's burden
(40 values against two canvases vs 20 against one). Every surveyed tool with a
real theme ecosystem went single-palette.

The framing offered was *"build A, name like B"* — accept that a B-scale
ecosystem won't materialise for a tool this size, but take B's naming discipline
now because it is nearly free up front and expensive to retrofit (which is
precisely what the border-rename seed was already worried about).

### Decision

**Mostly A, with two explicit contribution routes.** Lee is realistically the
only user, but:

1. **PR route → baked into the binary.** Anyone can open a pull request adding a
   theme. If Lee accepts it, it ships as a built-in.
2. **Drop-in route → auto-discovered from config.** A user puts a theme file in
   a `themes/` directory inside the Portal config dir and Portal picks it up
   automatically — no registration step. If it is valid it appears in the
   selector alongside the built-ins.

This lands on the ecosystem's standard two-tier shape (library directory +
selection setting) without committing to ecosystem-scale governance.

### Consequences carried forward

- **Token names still matter, but the blast radius is asymmetric.** Renaming a
  token is a repo-wide mechanical change for built-ins; it only *breaks* files
  in a user's `themes/` dir. That keeps the "name it right before shipping"
  pressure real without making it existential — and it is a further argument for
  settling the vocabulary in this feature rather than after.
- **Auto-discovery makes the validity rule user-visible.** "Valid ⇒ selectable"
  means an invalid file silently doesn't appear unless something says why.
  Research proposed the rule (all tokens present + syntactically well-formed),
  ratified later in this session rather than inherited (see the process note);
  this decision is what makes the surfacing load-bearing rather than a nicety.
  How it surfaces was revised twice — see "every theme file gets a row".
- **Two namespaces now exist** (built-in names and user-directory names), so
  collision/shadowing needs an answer — deferred to
  *theme-file-format-and-discovery*.
- **The authoring-burden argument for split is weakened but not removed.** A PR
  contributor still does the work, and dark-only famous palettes (Dracula, Nord)
  have no light half to supply.

---

## Theme file format & discovery

### Built-ins are theme files, not Go code (decided)

#### Context

The drop-in route (above) means Portal must parse a theme file. That raises a
fork the current code doesn't have: today `theme.MV` is a Go `var` holding a
struct of 20 `Token{Name, Light, Dark}` fields, so a built-in and a user theme
would be two different things arriving by two different paths.

#### Options considered

**Option 1 — built-ins stay Go structs.** User themes are parsed into the same
struct. Two authoring paths for one concept: a PR contributor writes Go, a
drop-in user writes a file.
- Cons: the paths can drift (Go can express what the format can't); the format's
  rough edges never bite the maintainer because he never uses it; two things to
  keep in sync.

**Option 2 — a built-in *is* a theme file**, embedded via `go:embed`, parsed by
the same loader as a user's.
- Pros: one code path, one format, one validity rule. A PR is "add a file". A
  user copies a built-in, tweaks two values, drops it in `themes/` — which is
  how people actually make themes. The format is dogfooded by every built-in, so
  a bad format is the maintainer's problem on day one rather than a stranger's on
  day ninety. Prior art: Ghostty and kitty avoid inventing a theme format at all
  — a theme *is* a config file.
- Cons: MV's values currently carry inline erratum comments (original →
  corrected hex, measured ratio) which a data file must either support or drop;
  parse failures move from compile-time to load-time, so built-ins want a test
  that loads all of them; `internal/capture`'s no-real-config import guard needs
  the embedded set reachable without touching the config path (fine — embed is
  not config).

#### Decision

**Option 2.** Both agreed independently, on symmetry and single-path grounds.

**The erratum comments are deleted, not ported.** Lee: *"we can just delete all
that … we don't need all that history spewing through with it."* The existing
MV values move across clean. This is defensible beyond taste: `contrast_test.go`
already enforces the corrected values numerically, so a comment recording *why* a
hex differs from its upstream Tokyo Night sibling is duplicated history — revert
a hex and the test fails, with or without the comment.

**Thread this opens:** it is the *test* that makes deleting the comments safe, so
whether built-in themes stay contrast-tested once they are data files becomes
load-bearing. Recorded against *test-and-capture-harness-impact*.

### Theme identity — filename is the slug (amended: the `name` field was later dropped)

#### Context

Surfaced by the background review: the discussion had made a file the unit of
both a built-in and a user theme, and deferred name collision, without ever
defining what a *name* is. Four distinct things were being conflated — the
filename, an in-file `name` field, the human display label in the selector, and
the durable slug persisted in `prefs.json`. Research raised slug-vs-display-name
(B4) as a durable-identifier question that was never answered.

#### Options Considered

**Filename is identity** — `themes/nord.json` → slug `nord`, displayed as `nord`.
- Pros: zero duplication; file and content cannot disagree; rename is a file
  move. Effectively what kitty and Ghostty do.
- Cons: display names are constrained to filename shape (`tokyo-night-day`, not
  "Tokyo Night Day").

**In-file `name` is identity** — filename irrelevant.
- Pros: free display names.
- Cons: two files can claim the same name; file and content can disagree — a
  confusion class the first option doesn't have.

**Both, with distinct jobs** — filename is the *slug* (durable key, persisted,
written in config); an optional in-file `name` is *only* the display label.
- Pros: they can never collide because only one is an identifier. The persisted
  value is structurally unique by virtue of being a filename in a directory, and
  the rendered value is free text. Renaming a theme is a file move — an
  operation users already understand.

#### Decision (amended — see below)

**Both, with distinct jobs.** Filename (minus extension) is the slug and the
durable identity Portal persists; an optional in-file `name` is the display
label in the selector, falling back to the slug when absent.

This also answers research's "theme names are the same class of public-contract
problem as token names" concern in the cheapest possible way: the contract is a
*filename*, so a user renaming their own theme is a deliberate file operation
with an obvious consequence, and Portal renaming a built-in is the same kind of
breaking change as renaming a token — visible, deliberate, and rare.

#### Amendment — slug rules, and the `name` field is dropped (the review's F6/F7)

The review found the mechanism non-deterministic, and one claim made elsewhere
false.

**The false claim.** The no-shadowing decision listed as a benefit that *"the
selector never shows two entries with the same label"*. It cannot hold — two user
files with distinct slugs (`nord-lee.theme`, `nord-mine.theme`) could both carry
`name = "Nord"`, and the panel renders labels. Identity never collides; labels
could. It also left alphabetical order ambiguous (by slug or by label — they
differ the moment a label is set).

**The undefined rules.** `My Theme.theme` would yield a slug containing a space,
persisted into a config value. Case-sensitivity was unstated (Portal's tag
precedent is deliberately case-sensitive). And on a case-insensitive macOS
filesystem, `Nord.theme` beside a built-in `nord` is precisely the collision the
no-shadowing rule exists to prevent.

**Decision 1 — the slug is constrained to `[a-z0-9-]`.** A file whose name does
not match is skipped and reported through the channel already decided (count in
the panel, detail in doctor: *"theme file `Nord.theme`: slug must be lowercase
letters, digits and hyphens"*). This removes the case question outright rather
than defining case-insensitive matching, so the reserved-name check stays **exact
string equality** — which is what the no-shadowing safety property requires.

**Reject, never normalise.** Lowercasing `Nord.theme` to `nord` would let it
shadow the built-in, breaking the rule it exists to protect.

**Decision 2 — the optional `name` field is dropped. The slug is the label.**
This is a **reversal** of the second half of the identity decision above, flagged
as such. It deletes the collision class and the sort ambiguity together
(alphabetical by slug, because the slug is the only name there is). The cost is
display prettiness — `tokyo-night-day` rather than "Tokyo Night Day" — judged not
worth a second identifier-shaped thing in the file, given every comparable tool
lists slugs (Helix, Zellij, Ghostty) and the constrained charset reads cleanly.

**Consequence:** a theme file now contains **exactly the 19 token keys** and
nothing else, which simplifies the F8 trust-boundary statement further.

### Namespace collision — no shadowing; built-in names are reserved

#### Context

Two namespaces exist (embedded built-ins, user `themes/` directory), and the
whole-theme-rejection decision puts a hard constraint on how they compose:
**an invalid theme falls back to the default built-in, so if a user file can
shadow the default built-in, the fallback itself can be broken** — drop in
`tokyo-night.json` with a typo'd hex and the thing Portal falls back to is the
same broken file. That must be impossible.

#### Options Considered

**User dir shadows built-ins, with reserved names** — the ecosystem norm
(two-tier search is standard; Helix reserves `default` and `base16_default`).
- Pros: lets a user correct a built-in in place, keeping the name they know.
- Cons: a reserved-name special case; "which `nord` am I looking at?" ambiguity;
  a precedence chain to document.

**Built-ins always win; a colliding user file is silently ignored.**
- Pros: no reserved-name case.
- Cons: silent — you edit a file and nothing happens, with no signal at all.

**No shadowing; built-in names are reserved, full stop.** A user file whose slug
collides with a built-in is rejected through the same message channel as any
other invalid theme.
- Pros: collapses the reserved-default special case into one general rule; the
  selector never shows two entries with the same label; no precedence chain; the
  failure is loud rather than silent.
- Cons: to tweak a built-in you must copy it under a new slug.

#### Decision

**No shadowing.** Built-in slugs are reserved; a colliding user file is rejected
with a message naming the conflict.

Deciding factor: the workaround is a two-second file rename and is
self-documenting. Lee: *"if I wanted to edit that as a user theme, I would just
call it Nord-Lee. So it's really not a big deal."* And with the PR route open,
genuinely *correcting* a built-in has a proper channel rather than needing a
local override.

### File format — flat `key = value`

#### Context

Research found **no ecosystem consensus whatsoever** — each tool uses whatever
its config already used (Helix TOML, k9s YAML, Zellij KDL, btop flat
`key="value"`, atuin TOML, gitui RON, Glamour JSON, base16/tinted8 YAML). So the
decision is Portal-internal, and Portal's constraint is sharp: **no third-party
YAML or TOML dependency exists** — every config today is stdlib `encoding/json`
(`projects.json`, `hooks.json`, `prefs.json`, `terminals.json`) plus one flat
`key=value` file (`aliases`).

#### Options Considered

**JSON** — matches most existing config, zero new deps.
- Cons: **cannot carry comments**, and a theme is the one config file that
  genuinely wants one — ported palettes need attribution, and attribution was
  settled as repo-side rather than in-UI, making a file header its natural home.
  Also the most punctuation-heavy way to express a flat map of 20 strings.

**TOML** — comments, less punctuation.
- Cons: adds a third-party parser to a codebase that has deliberately avoided
  one for config; buys nesting Portal doesn't need.

**Flat `key = value` with `#` comments**
- Pros: Portal already parses this shape (`aliases`), so it is not a new idiom.
  Zero deps, minimal punctuation, comments free. A theme is literally 20
  key→value pairs. Closest structural match in the survey is
  btop (`theme[main_bg]="#…"`, 41 lines, flat).
- Cons: a hand-rolled parser (small); a second non-JSON config format to
  document.

#### Decision

**Flat `key = value` with `#` comments.** Lee: *"nice and simple."*

The dividing line already implicit in Portal's own config supports it —
*nesting needed → JSON* (`terminals.json` maps glob patterns to command recipes;
`projects.json` is machine-written), *flat human-authored map → flat file*
(`aliases`). A theme is squarely the second.

**Forward note (not a decision):** the deferred transparent-theme idea would need
a distinguished value meaning "use the terminal default" — btop's precedent is an
empty value. The format should leave that door open rather than close it.

#### Lexical rules (the review's F3)

The format was justified by pointing at `aliases` as precedent, but `aliases` has
**no comment syntax and no `#`-prefixed values**, so it does not carry the hard
case: **`#` is both the comment marker and the hex prefix, and every value in a
theme file starts with `#`.** Comment support is *why* this format was chosen
over JSON — it is where a ported palette's attribution lives, and where the note
explaining the eyeball-pinned light tints goes — so the collision has to be
resolved explicitly. It matters more than usual because the format **is** the
public contract, the loader is hand-rolled by decision, and doctor promises a
per-file reason string that can only be as precise as the rules it enforces.

The forcing case:

```
text.primary = #ECEFF4 # tuned for the lighter canvas
```

— a colour plus a trailing note, or one invalid value?

**Decisions:**

- **`#` starts a comment only at the beginning of a line** (after optional
  leading whitespace). No trailing comments, so the ambiguity never arises — a
  `#` after `=` is always part of the colour.
- **Values are bare, never quoted.** A quoted value is rejected with a message
  saying so. (btop, the cited structural match, quotes; `aliases` does not — one
  had to be picked and stated.)
- **A duplicate key is rejected**, not resolved. Silently taking one of two
  conflicting values for a token is exactly the quiet wrongness the validity rule
  exists to prevent, and "all 19 present" would otherwise have to define what a
  repeat counts as.
- Whitespace around `=` is trimmed; blank lines ignored; keys are lowercase by
  definition (per the slug/vocabulary charset) and matched case-sensitively;
  CRLF tolerated; a BOM is stripped.

### Value domain — hex only, `#RRGGBB`

#### Context

Research named this "the actual decision here" for validation: everything else
about the validator follows from what values a theme may contain. `Token`'s own
doc comment currently sanctions ANSI indices, so hex-plus-index was a live
option, not an invented one.

The pressure comes from `lipgloss.Color`, which **never returns an error** and
whose accepted domain is wider and stranger than a theme format wants: `"212"`
is a valid ANSI-256 index, `"-5"` is silently abs'd to `5`, `"16777215"` is
reinterpreted as packed RGB (white), and every failure is the silent `noColor`
sentinel. Portal therefore owns its own validator regardless — which is what
turns all of that into one honest message ("theme `nord`: `text.primary` =
`#GGGGGG` is not a valid colour").

#### Decision

**Hex only, `#RRGGBB`.** No ANSI indices, no named colours, no `#RGB` shorthand
(six digits cost nothing and remove a parse branch).

Two reasons, the second decisive:

- Spec §2.4 is an explicit decision that Portal **imposes its own exact hues via
  truecolor and does not inherit the terminal's 16 ANSI colours** — a
  recognisable identity needs consistent hues across machines. Admitting ANSI
  indices lets a theme opt back into the palette Portal deliberately declined
  (research A5 records ANSI-inheriting themes as the road not taken).
- **An ANSI index has no fixed RGB.** The validator must parse to RGB anyway,
  and that same parse is what any future contrast check needs. A token valued
  `212` cannot be measured against anything — admitting them would permanently
  foreclose checking a theme numerically, including Portal's own built-ins.

Confidence: **high on the reasoning, low investment from Lee** — he explicitly
deferred to the recommendation rather than holding a position. Worth re-testing
in spec if it constrains something unforeseen.

### Theme variant (light/dark identity) — no such concept

#### Context

Research listed this as *"a related mechanic split needs anyway"*: under split,
Portal must know whether a given theme is light or dark — either declared in the
file (tinted8 requires `variant: dark|light`) or derived from the theme's own
canvas luminance (Ghostty's theme browser does this with Rec.709 coefficients
and a 0.5 threshold). The orchestrator opened this as a genuine choice and
recommended deriving.

#### Journey — the premise was wrong

Lee pushed back: *"Do we care? I don't think Portal needs to know, does it?"*
And he is right. The framing assumed Portal has to classify themes itself, which
it does not:

- Under the adaptive two-slot form, **the slot classifies the theme.**
  the light slot means "use this when the terminal is light" — Portal never
  inspects the palette to know that.
- Warning that a dark theme sits in the light slot is exactly the *perceptual*
  judgement already ruled out of validation (validity is syntactic, never
  perceptual).
- Grouping or filtering the selector list by variant is the panel search/filter
  feature already deferred as YAGNI.

So the mechanic has **no consumer**.

#### Decision

**No variant concept.** Not declared, not derived.

The asymmetry is what makes not-deciding safe rather than merely convenient:
*declaring* would lock a key into the public contract now, whereas *deriving*
costs nothing and needs no format change — so if a selector filter ever ships,
the value can be computed that day. Not deciding is free here; deciding is not.

---

## Light/dark detection — ships, follows the terminal, two-slot form

### Context

Portal owns a mode-matched canvas, so something must decide which canvas to
paint. Today that is `prefs.appearance = auto|light|dark` plus an OSC 11
detect-or-timeout gate. Split removes the *variant* axis from the theme, so the
question re-forms as: does Portal detect at all, against which signal, and what
does the user-facing setting look like?

Research spent the majority of its time here and arrived at "match the terminal"
— but flagged it for ratification. This section ratifies it and records the
journey, because the journey contains two reversals that are easy to
re-introduce if forgotten.

### Journey — including two false paths

**1. The starting premise was that detection is unreliable inside tmux.**
Inherited from the `spectrum-tui-design` discussion, repeated in Portal's README,
and used as the main argument for deleting the appearance axis entirely.

**2. Lee proposed deleting the appearance axis outright** — no `auto`, no
light/dark as a config concept; split MV into two ordinary themes and select
manually. The appeal was large: `appearance_gate.go` (167 lines), the 50ms
first-paint wait, `prefs.Appearance`, `Token.ColorFor`, and the dual-canvas
contrast bookkeeping all lose their only consumer.

**3. DEC mode 2031 was found to be plumbed end-to-end in Portal's stack** —
`x/ansi` has the mode constants and report parsers, `ultraviolet` decodes DSR
`997;1`/`997;2` into typed events, and Bubble Tea v2 passes them through to
`Update` verbatim (`type Msg = uv.Event` is a type *alias*, and
`translateInputEvent` returns unhandled events bare). Portal opts in with
`tea.Raw(ansi.SetModeLightDark)`. tmux 3.6+ supports it and the installed tmux is
3.7b. That looked like it refuted the unreliability premise.

**4. FALSE PATH — 2031 answers a different question.** The packages say so
explicitly: `ModeLightDark` reports *"the **operating system's** color scheme
preference"*. OSC 11 answers *"what colour is my terminal's background?"*. Those
routinely disagree, and Lee's own environment is the disagreement case — a
Ghostty pinned dark on a light macOS. A further wrinkle cuts the same way: on
terminals that don't support 2031, tmux *synthesises* the answer by guessing from
the background colour, which is the very signal whose unreliability was the
original objection. So 2031 is a better-engineered answer to a question Portal
may not be asking.

**5. The unasked question: what is detection FOR?** Because Portal owns an
opaque canvas and guarantees its contrast floors against that canvas, a
mode mismatch is *jarring, never illegible*. Detection's entire payoff is
therefore **aesthetic blending with the surrounding terminal** — and naming that
is what discriminates the signals. Blending wants the terminal's background,
which is OSC 11's question, not 2031's.

**6. The live test settled it.** Lee set macOS to light with Ghostty pinned dark
and captured screenshots. His shell prompt broke badly — it followed the OS, set
*foreground only*, and inherited a background it does not control, so contrast
collapsed into washed-out barely-legible text. Portal, in the same terminal in
the same state, rendered perfectly. Portal paints **both** (leaf
`.Background(canvas)`, the outer `fillCanvas`, and OSC 11 for the gutter), so it
cannot produce that failure whichever signal it follows — but the comparison
shows exactly what following the OS costs anything that doesn't own its
background.

**7. Retroactive correction — the tmux premise was probably never true here.**
Ghostty being pinned dark means Lee's original observation (Portal stayed dark
when macOS went light) was Portal reading the terminal *correctly*. OSC 11 was
working the whole time. The "detection is unreliable inside tmux" premise, which
drove a large part of the research session and sits in the README, is retired.

### Decision

**Detection ships. The signal is the terminal background via OSC 11. Mode 2031
is deliberately not adopted. The user-facing form is Helix's two-slot shape.**

Three arguments carried it:

1. **Transition dominance.** Portal's dwell time is seconds — launch, pick, exec
   into a session, many times a day — so the transition in and out dominates the
   experience. Matching the terminal reads as "your terminal, with a picker in
   it". Matching the OS against a pinned terminal flashes light and drops back to
   dark, twice per use. (Correcting an earlier framing: Portal does not sit
   *inside* anything — it covers the window edge to edge, so the mismatch is felt
   only at the transition.)
2. **A terminal/OS mismatch is usually deliberate, not stale.** Lee's Ghostty is
   *pinned* dark — an explicit choice about the environment Portal lives in. For
   something that lives inside a terminal, the terminal's background is arguably
   the *more* relevant preference, not the weaker one.
3. **Forward compatibility with transparency**, which is deferred-not-rejected.
   A transparent theme *must* follow the terminal background. Choosing terminal
   now makes adding transparency later **purely additive** — no second mechanism,
   no per-theme signal selection. Choosing OS now makes it expensive.

**Config shape** (no `appearance` setting exists anywhere — the override is the
*shape* of the theme setting):

- `"theme": "tokyo-night"` — a constant. Detection is never consulted.
- `"theme_light": "…"` / `"theme_dark": "…"` — opts in; detection chooses.
- A no-answer resolves to the **dark** slot (Helix carries an explicit third
  `fallback` value for exactly this, defaulting to dark; Helix, Neovim, delta and
  Glamour v2 all use dark as the universal no-answer fallback).

### Accepted cost

**OSC 11 is query-only; 2031 pushes on change.** So Portal gets
*correct-at-startup*, not *live-following* — a terminal that flips mid-session
is not noticed until the next launch. Judged thin: terminal backgrounds rarely
change mid-session, and when they do it is usually because the terminal is itself
following the OS.

### Precision — what actually dies, and what does not

An earlier research framing counted the whole appearance gate and the 50ms
first-paint wait as deleted. Under the two-slot form that is **only partly
true**, and the difference matters:

- **Dies:** `prefs.Appearance` (the `auto|light|dark` enum, its tolerant decode,
  `LoadAppearance`/`SaveAppearance`, `WithAppearance`) — replaced by the shape of
  the theme setting. Note `SaveAppearance` has no production caller today, so
  this is mostly read-path removal.
- **Dies via split, not via this decision:** `Token.ColorFor`, `theme.Mode`
  threading, the dual-canvas contrast bookkeeping.
- **Survives, but becomes conditional:** the detect-or-timeout gate. A user on a
  constant theme needs no detection, so their first paint is immediate — a real
  startup win. A user on the two-slot form still needs light/dark resolved
  *before* first paint or Portal paints one theme and flips, so the same race,
  timeout and dark fallback still apply to them.
- **Survives unchanged:** the OSC 11 *query* itself (`restore.go` needs it to
  capture the original background for restore-on-exit, independent of
  detection); the `NO_COLOR` carve-out; and the canvas-echo guard, whose
  comparison re-points from "the mode's canvas" to "the active theme's canvas".

Confidence: **high.** Ratified against research's landed position with the live
test as evidence; the only soft spot is the accepted loss of live-following.

### The one-shot seed job — not shipped

Research separated detection into two independently-optional jobs: **Job 2**,
follow the terminal continuously (what the two-slot form is), and **Job 1**, use
detection once to seed a default for a user who has configured nothing.

Under the locked design, detection acts only when the user nominated a pair — so
a brand-new user with a light terminal gets the dark default and stays there
until they change it. Job 1 would use the OSC 11 reply, on a launch where nothing
is configured, to start on the light built-in instead.

**Options weighed.** It is cheap: the reply arrives anyway for `restore.go`'s
original-background capture, and because nothing is gated on it, it needs no race
and no timeout. Research named the real hazard as scope creep on the trigger —
if it fires on anything other than "the user has never chosen", the between-run
flipping returns, which is what made `auto` *feel* broken even when working as
designed.

**Decision: not shipped.** The two-slot form already gives anyone who cares about
matching their terminal an explicit and reliable way to say so, so the seed buys
one saved setup step at the cost of a second detection consumer with different
semantics from the first. Research A4 also found that **no terminal application
surveyed prompts or seeds on first run** — every one ships a hardcoded default
and starts rendering. "Unconfigured user sees the dark default" is the
convention, not a failure.

---

## Token vocabulary & rename

### The two border tokens are one role — consolidate

#### Evidence

Research left one item as genuinely-still-research: *does any surface render both
border tokens together in a way that requires them to differ?* Checked in code
during this session, and the answer is no — the code says so explicitly.

- `panel.go`'s `renderJoinedPanel` doc comment: *"single-tone: the 2-tone footer
  leg of §8.1 was dropped in task 3-4"*. **Spec §8.1's "2-tone border
  (`border.separator` + `border.footer`)" is stale** — the implementation dropped
  it and the helper takes a single border token.
- `border.separator` serves the title rule (`header.go:130`), every modal panel
  frame (destructive-confirm, edit, help, rename), and edit-modal chips.
- **`border.footer` has exactly one production consumer** — `footer.go:267`, the
  footer rule.
- The two carry an **identical light hex** (`#C9CDDB`), differing only in dark
  (`#292E42` vs `#20232E`).

Under split this becomes visible in the artefact itself: the light theme file
would carry two keys with the same value, and the dark file two keys differing by
a shade nothing ever renders side by side.

#### Decision

**Consolidate to one border token.** `border.footer` is dropped; the footer rule
renders with the same token as the title rule. The vocabulary goes **20 → 19**
(`TestMVTokenCount`'s exact-20 pin moves with it).

Accepted visual change: the footer rule becomes marginally more prominent in dark
(`#292E42` rather than `#20232E`) — verifiable directly through the capture
harness. Lee: *"we don't need tokens that are marginally different when they
don't appear together. That's just drift."*

This dissolves the border seed's original premise. There is no longer a
*two*-token rename to settle — there is one border token to name, inside a wider
vocabulary question.

### Scope — full audit of all 19, including the hue-named accents

#### The finding research missed

Research's audit flagged three issues (`bg.track` is use-site-derived; the
`text.on-*` tokens are pairing names coupling to other tokens; the text ramp
encodes no ordering). It did not flag the largest one:

**Six tokens are named after MV's hues, not their roles** — `accent.violet`,
`accent.blue`, `accent.cyan`, `state.green`, `state.red`, `accent.orange`.

For a single built-in this is harmless: MV's primary accent *is* violet. As a
public theming contract it is guaranteed to lie. A Gruvbox port has no violet, so
its author writes `accent.violet = "#d79921"` — Gruvbox yellow — and the key
actively misdescribes its own value. Every port after the first has this problem,
and it cannot be fixed later without breaking their files.

It is the same anti-pattern the border seed logged, but larger in scale and
worse in kind: `border.footer` merely *goes* stale as surfaces reuse it, whereas
a hue name is wrong the moment anyone themes against it.

#### The distinction that defines the target

Three naming failures are in play and only two are failures:

- **A place** (`border.footer`) — wrong; goes stale as surfaces reuse the token.
- **A hue** (`accent.violet`) — wrong; lies in every port.
- **A meaning** (`state.destructive`) — right; stays true regardless of palette
  or where it is drawn.

The third is the target. Crucially this does **not** mean everything becomes
weight-based: research (A7) found use-site naming is the ecosystem *norm* (Helix
names essentially its whole UI half that way). The ramp and the border want
intrinsic-**weight** names because their role genuinely is "how prominent"; the
accents want **meaning** names because a theme author needs to know what a colour
signifies in order to choose one.

§2.1 already defines these roles in exactly those terms — "primary accent",
"key-hint", "state — attached", "state — destructive", "filter/search &
warning", "preview mode-chrome". The role names already exist in the spec; the
tokens simply do not use them.

#### Decision

**Full audit of all 19 tokens**, including renaming the hue-named accents to
their roles. Lee: *"let's absolutely audit that! This is the perfect time to do
so!"*

### The scheme (decided)

Accepted as proposed, including all three flagged spots resolved to the
recommendation: `accent.key` (not `accent.keyhint`), `bg.subtle` (not
`bg.inactive`), and the ramp's ordinal/qualitative join accepted with **file
ordering as part of the contract** — the ramp ships in ramp order with a header
comment saying so (base16's rule that ordering is spec, not incident). Fully
positional names (`text.1`…`text.6`) were rejected: they would remove the
ambiguity but strip all meaning from ~20 files of call sites.

| # | Current | Proposed | Why |
|---|---|---|---|
| 1 | `text.primary` | `text.primary` | unchanged — top of ramp, already intrinsic |
| 2 | `text.strong` | `text.secondary` | ordinal makes ramp position explicit |
| 3 | `text.muted-bright` | `text.tertiary` | current name is self-contradictory |
| 4 | `text.detail` | `text.muted` | `detail` describes content, not weight |
| 5 | `text.dim` | `text.subtle` | ladder consistency |
| 6 | `text.faint` | `text.faint` | unchanged — decorative floor |
| 7 | `text.on-selection` | `text.on-selection` | unchanged — contrast pairing (Crush `onPrimary` convention) |
| 8 | `accent.violet` | `accent.primary` | hue → role (§2.1 "primary accent") |
| 9 | `accent.blue` | `accent.key` | hue → role (§2.1 "key-hint") |
| 10 | `accent.cyan` | `accent.mode` | hue → role (§2.1 "preview mode-chrome" = signals a distinct mode) |
| 11 | `accent.orange` | `accent.attention` | hue → role; one warm token covers filter query, edit-mode, warning flash |
| 12 | `state.green` | `state.positive` | hue → meaning (live / attached / success) |
| 13 | `state.red` | `state.destructive` | hue → meaning |
| 14 | `canvas` | `canvas` | unchanged — already intrinsic |
| 15 | `bg.selection` | `bg.selection` | unchanged — names a state, not a place |
| 16 | `bg.warning` | `bg.attention` | pairs with `accent.attention` |
| 17 | `bg.track` | `bg.subtle` | use-site → intrinsic weight (a low neutral fill) |
| 18 | `border.separator` | `border` | sole border token after consolidation |
| 19 | `text.on-warning` | `text.on-attention` | lockstep with `bg.attention` |

**Three spots flagged as genuinely arguable:**

1. **The ramp's middle join.** `text.tertiary` → `text.muted` mixes an ordinal
   vocabulary with a qualitative one, so the ordering at that join rests on
   convention rather than the names. Fully positional names (`text.1`…`text.6`)
   would remove the ambiguity but strip all meaning from ~20 files of call sites.
   *(The mitigation first proposed here — "the ramp ships in ramp order in the
   file, ordering is part of the contract" — was **withdrawn**; see below.)*
2. **`accent.key`** could read as "important" rather than "keyboard key";
   `accent.keyhint` / `accent.hint` are the alternatives.
3. **`bg.subtle`** reuses the word from `text.subtle` in a different namespace;
   `bg.inactive` is the alternative but generalises less well.

---

## Built-in theme set & quality tiers

### The shipped set — three built-ins

**Revised mid-session.** The set was first decided as four (Tokyo Night Dark,
Tokyo Night Light, Nord, and one further light theme). Lee then spotted that the
discussion had decided the *set* without ever designing the new palettes — and
under the two-tier quality rule a bundled theme must be **good**, not merely
valid, so each port is a design task with its own contrast-tuning and eyeball
gate.

Three routes were weighed: **(a)** split only (two themes — satisfies the letter
of "not a single built-in" but not the spirit of "genuine options", being one
palette in two modes); **(b)** split plus Nord; **(c)** the original four.

**Decision: (b) — three built-ins.**

- **Tokyo Night Dark** and **Tokyo Night Light** — the existing MV values, split
  into two themes. Nothing is lost.
- **Nord** (dark-only, as the palette is).
- A further light theme **follows up as separate work**.

The deciding argument was **risk, not scope**: the 19-token vocabulary has only
ever been exercised by the palette it was designed for, so porting one genuinely
external palette is the first real test of whether the roles map cleanly — and
that test must happen *before* the names become a public contract. Nord makes
the test unusually sharp because its canvas is `#2E3440`, a mid-dark rather than
a near-black, so its contrast headroom is materially tighter than MV's.

The counterweight is that everything after the first external theme is cheap by
construction: `go:embed` makes adding a theme literally adding a file, and the PR
route exists to receive exactly that. A follow-up "more themes" task is the
system being used as designed rather than deferred work.

Accepted cost: the light side ships with a single option until the follow-up.
The adaptive default still works out of the box either way, since it is Tokyo
Night on both slots.

### The Nord port, analysed against the real spec

Worked through in session against the published Nord palette (16 colours:
Polar Night `nord0–3`, Snow Storm `nord4–6`, Frost `nord7–10`, Aurora
`nord11–15`) and Portal's actual rule set in `contrast_test.go`.

**Result: the vocabulary survives, but the floors force two corrections.**

Every Nord colour measured against Nord's own canvas (`nord0 #2E3440`):

| | ratio | | ratio |
|---|---|---|---|
| nord1 `#3B4252` | 1.24 | nord9 `#81A1C1` | 4.64 |
| nord2 `#434C5E` | 1.45 | nord10 `#5E81AC` | 3.10 |
| nord3 `#4C566A` | 1.69 | nord11 `#BF616A` | **3.05** |
| nord4 `#D8DEE9` | 9.25 | nord12 `#D08770` | 4.39 |
| nord5 `#E5E9F0` | 10.26 | nord13 `#EBCB8B` | 8.00 |
| nord6 `#ECEFF4` | 10.84 | nord14 `#A3BE8C` | 6.13 |
| nord7 `#8FBCBB` | 5.99 | nord15 `#B48EAD` | 4.41 |
| nord8 `#88C0D0` | 6.24 | | |

**Maps clean:** canvas ← nord0; `text.primary/secondary/tertiary` ← nord6/5/4;
`text.faint` ← nord3 (1.69 sits correctly inside the decorative band, above 1.0
and below 3.0); `bg.selection` ← nord2 (fill 1.45 ≥ 1.10, and nord6 on it is
7.49 ≥ 4.50); `bg.subtle` ← nord1; `border` ← nord3 (no numeric floor);
`accent.primary` ← nord15 (4.41 ≥ 3.00); `accent.key` ← nord9 (4.64);
`accent.mode` ← nord8 `#88C0D0` (6.24 — chosen over nord7, being Nord's own primary UI accent); `accent.attention` ← nord13 (8.00);
`state.positive` ← nord14 (6.13); `text.on-selection` ← `#FFFFFF` (8.63 on
nord2 — a functional maximum for text on a tint, as MV also uses, rather than a
palette claim); `text.on-attention` ← nord6.

That is all 19 assigned: 14 taken directly from Nord, two corrected, three
invented.

**Correction 1 — the red fails.** `state.destructive` carries the **4.5** normal
floor, and Nord's red `nord11 #BF616A` measures **3.05** against Nord's own
canvas. **Decision: ship the corrected value `#DD8188` (4.50).** The floor rule
holds with no carve-out — this being the *first* external palette, a carve-out
granted here would set the precedent for every PR theme after it.

**Method note, and a bug worth carrying to spec.** The first correction offered
was `#CF888F`, derived by raising HSL lightness with saturation held constant.
Lee rejected it on sight — *"washed out and … more pink"* — and he was right:
raising lightness at fixed HSL saturation **drops actual chroma**, so that value
lost ~27% of Nord's red saturation. Re-derived as the colour of least perceptual
distance from `#BF616A` (measured in **Oklab**) that still clears 4.50, the
answer is `#DD8188`, which retains ~94% of the chroma at the identical ratio.

So: **contrast corrections must be computed in a perceptual space, never by
moving HSL lightness.** This will recur on every future port. It also raises a
check to run when MV's own values move into theme files — its erratum values are
described as *"darkened, hue-preserved"*, which may carry the same flaw in the
opposite direction.

**Correction 2 — the ramp's middle does not exist in Nord.** Nord's greys are
barrelled at the ends: three bright (9.25 / 10.26 / 10.84) and three dark (1.24 /
1.45 / 1.69), with nothing between. Portal needs `text.muted` ≥ 4.5 and
`text.subtle` in the 3.0–4.5 band, so **two values must be invented** —
e.g. `#939EB2` (4.62) and `#73819B` (3.18), interpolated on nord3's hue and
saturation.

**Correction 3 — the warning band (added after the third review found the
mapping covered only 16 of 19 tokens).** `bg.attention` and `text.on-attention`
were missed, and they are the hardest remaining pair for a 16-slot palette:
`bg.attention` is a *background tint* — neither a neutral from the barrelled dark
end nor a foreground accent — and `text.on-attention` carries a pairing floor
against it. The rule set (`TestBgWarningPairRule`) has three legs: text-on-tint
≥ 4.5, the accent bar ≥ 3.0 vs canvas, and the fill ≥ 1.1 vs canvas.

Nord satisfies it, but only with a **third invented value** for `bg.attention`.
The bar leg is already clear — nord13 is 8.00 vs canvas — and `text.on-attention`
← nord6 needs no invention.

**Revised after a visual gate (the review's F9).** The first value offered was
`#54524F` (a ~20% nord13-into-canvas blend, fill **1.60**), derived purely
arithmetically. Checked against **how MV actually does this band**, that is far
too heavy: MV's `bg.warning` `#241B10` measures only **1.15** against its canvas —
the tint is a whisper, not a wash. A 20% blend also pushed the tint into a warm
grey outside Nord's distinctly cool family, which is exactly what the review
flagged.

**Settled: `bg.attention` = `#3D4046`** (~8% blend, fill **1.20** — matching MV's
proportion), carrying nord6 `#ECEFF4` at **9.02**. At that strength the tint stays
recognisably Nord rather than reading as warm grey.

**One honest divergence from MV:** MV warms its on-band text (`#E8C9A0`) to match
the band. Nord's Snow Storm is entirely cool and has no warm light, so
`text.on-attention` uses nord6 — cooler than MV's treatment, but faithful to the
palette. Recorded as a deliberate port choice.

Frame: `Sessions — Nord inline flash (bg.attention #3D4046)`.

**Visual-gate note for the other two invented values:** `text.muted` and
`text.subtle` have already been seen — `text.muted` is the "N window(s)" text in
`Sessions — Nord (port)`. Only `bg.attention` had never been rendered, which is
why it was the one that needed the frame.

**Tally: two corrected values (`state.destructive`, `state.positive`) and three
invented ones (`text.muted`, `text.subtle`, `bg.attention`)** — see "the unwalked
legs" below, which found the second correction.

**One further structural finding, corrected.** Nord's dark end holds only three
values (nord1/2/3) for Portal's **five** dark-end roles (`bg.subtle`,
`bg.selection`, `border`, `text.faint`, `bg.attention`) — the earlier count of
four omitted the warning tint. So `nord3` serves both `border` and `text.faint`,
*and* `bg.attention` has to be interpolated outright. A palette choosing one
value for two roles is legitimate (unlike two tokens that differ pointlessly,
which the border consolidation removed), but the gap is wider than first
recorded: the 19-token vocabulary is meaningfully wider than a 16-slot ANSI
palette at the dark end, and every port should expect to invent there.

### The unwalked legs — a second correction (the review's F8)

The port was originally measured against roughly half of `contrast_test.go`'s
fourteen tests. Walking the rest found one genuine failure:

| Leg | Nord | Floor | |
|---|---|---|---|
| `bg.subtle` fill vs canvas | 1.24 | ≥ 1.10 | ✓ |
| **`state.positive` on `bg.selection`** | **4.23** | **≥ 4.50** | **✗** |
| `text.on-selection` on `bg.selection` | 8.63 | ≥ 4.50 | ✓ |
| `text.secondary` on `bg.selection` | 7.09 | ≥ 4.50 | ✓ |
| `text.tertiary` on `bg.selection` | 6.39 | ≥ 4.50 | ✓ |
| `text.on-attention` on `bg.attention` | 9.02 | ≥ 4.50 | ✓ |
| `accent.mode` vs canvas (peek chrome) | 6.24 | ≥ 4.50 | ✓ |
| `text.subtle` band | 3.18 | 3.00–4.49 | ✓ |
| `text.faint` band | 1.69 | 1.00–2.99 | ✓ |
| `state.destructive` vs canvas | 4.50 | ≥ 4.50 | ✓ |

**`state.positive` needed correcting too.** `TestStateGreenClearsCanvasAndSelection`
requires the single token to clear **both** the canvas and the selection tint;
nord14 `#A3BE8C` clears canvas at 6.13 but only 4.23 on nord2. This is precisely
the problem MV itself solved — its light green was darkened *"so the single token
clears bg.selection"*.

**Corrected to `#A7C492`** (minimal Oklab distance, ΔE **0.018** — essentially
imperceptible), clearing selection at 4.50 and canvas at 6.51, with chroma
marginally *above* the original.

**Lesson recorded:** the earlier tally was presented as a result when it was a
floor. The floor test auto-enumerating the embedded set means a missed leg surfaces
at implementation rather than shipping — but a failure on an unwalked leg can force
re-deriving an *invented* value, which by this port's own precedent then needs a
fresh visual gate.

### Derivation method for *invented* values (the review's F9)

The method note established that **corrections must be computed in a perceptual
space, never by moving HSL lightness**. The three invented values were then
produced arithmetically (`text.muted`/`text.subtle` interpolated on nord3's hue and
saturation; `bg.attention` an ~8% blend), which looks like a violation.

**Clarified: the rule governs *corrections*, not *inventions*.** A correction has a
published source value whose chroma must be preserved — that is what HSL-lightness
movement destroys. An invented value has no source to preserve; its constraints are
landing in the right band and looking right, which is why `bg.attention` was
settled at a **visual gate** rather than by arithmetic (and why its first
arithmetic answer was wrong by a factor of three).

**Outstanding visual gate:** `text.subtle` has no locus on any captured Nord frame
— it renders group `··· N` counts and pending loading steps, neither of which
appears on the flat Sessions frame. It needs a gate at implementation, on a grouped
Nord capture.

### Fidelity versus floors — resolved

The tension the review raised as F5 is answered: **the floors win, and the
corrected values ship under the palette's own name.**

Nord is a 16-slot ANSI palette; no application maps it 1:1 onto its own semantic
roles, so every Nord port in the wild adapts (Ghostty, Zellij and k9s all ship
one). The corrections here are minimal and perceptually close, and
`docs/theming.md` records them alongside the attribution.

Judged **visually, not numerically** — both reds were mocked in a Nord kill modal
and compared side by side. Lee: *"if red as published fails the contrast settings
that we've established, then let's go for the corrected v2."*

**Relaxing the floor for a named port was the one option ruled out**, because it
would break the bundled-tier guarantee that is the entire point of having tiers.

Paper frames: `Sessions — Nord (port)`, `Kill Modal — Nord (state.destructive
#DD8188)`, `Sessions — Nord inline flash (bg.attention #3D4046)`. *(The
`#BF616A` comparison frame was deleted once the decision landed — the rejected
value is recorded here rather than kept on the canvas.)*

All three appear in the slide-over alongside anything the user has dropped in
their themes directory.

### Two quality tiers (answers the review's F14)

**Contrast floors apply to what Portal ships; syntactic validity applies to what
users write.**

- **Bundled** (built-in, or an accepted PR — a PR is *intake into this tier*):
  must be valid **and good**. Contrast floors, bands and thresholds are checked.
  It carries Portal's name, and this is what stops the selector filling with
  Portal-endorsed themes nobody can read.
- **Drop-in** (user themes directory): must be **valid only** — all 19 tokens
  present, every value well-formed. Whether it looks good is the user's business.
  Lee: *"we can't control what users do … it has to be valid, but it doesn't have
  to look good."*

This is consistent with the position recorded in research (the strict floor was
for MV, the theme Portal designs) and with floors already being MV-specific in
code.

**Consequence:** porting is not free. A straight palette lift may not clear the
floors unmodified — MV's own light variants needed six individual corrections.
Each bundled theme is real work, which argues for shipping a small number well
rather than a large library.

---

## Shipped default & the theme setting's two states

### Decision — ship the adaptive pair (option b)

Portal ships with the light/dark pair already nominated
(`"theme_light": "tokyo-night-day"`, `"theme_dark": "tokyo-night"`), so a brand-new user gets
whichever matches their terminal, automatically.

The alternative considered was shipping a constant dark default, with the
light-terminal user changing it once.

**Two corrections landed on the way.** First, this was a *gap*, not a reversal:
the earlier decision was to skip the **one-shot seed** (detect once on a virgin
install and persist), which is a different mechanism; the shipped default config
had never been decided. Second, the orchestrator's earlier claim that "every
surveyed application ships a hardcoded default and starts rendering" came from a
research paragraph research itself marked **SUPERSEDED and explicitly refuted**.
The surviving claim is narrower — nobody *prompts* on first run (A4). On
detection, A1 is the opposite: `bat` (`--theme` defaults `auto`), `delta`
(`--detect-dark-light` defaults `auto`), Neovim (`background` auto-set by the TUI
on startup and re-detected when a UI attaches) and `yazi` all detect **by
default**.

Reasons:

- The 50ms is a **timeout, not a price** — terminals that answer do so in
  single-digit ms — and it applies only to TUI launches, since
  `portal open <target>` execs without painting.
- It **degrades to the alternative**: no answer resolves to dark, so (b) is a
  superset of (a) with a bounded downside.
- **Asymmetric escape.** Pinning is one line and is the *simpler* config
  (`"theme": "tokyo-night"`), so an annoyed user has an obvious remedy. The
  alternative's failure has no signal at all — a light-terminal user gets a dark
  Portal forever and never learns a light theme exists.

**Risk named:** a terminal that answers OSC 11 inconsistently makes Portal flip
between launches — the exact thing that made `auto` feel broken historically.
Lee's environment is evidence against it (the live test showed OSC 11 working
reliably through tmux); the one-line pin is the remedy.

### There are only two states, not three

"Nothing set" and "pair nominated" are the same thing — the shipped default *is*
an implicit pair. So the loader needs no unconfigured branch, only a default
value for the pair. A theme setting is either:

- **constant** (`"theme": "nord"`) — detection off; or
- **adaptive** (`"theme_light"` / `"theme_dark"`) — detection on.

---

## Slide-over panel — interaction model

### Journey

Lee's opening model was: arrow previews live, `Enter` sets a constant **and
closes**, slot keybindings assign dark/light without closing, `Esc` closes.

**First correction — `Enter` and `Esc` cannot both commit.** Research had landed
on *persist-on-close* (apply-on-arrow, save whatever you're on when the panel
closes, with a "saves on close" hint). An explicit `Enter` breaks that: if `Esc`
also saves, `Enter` does nothing `Esc` doesn't. So one must not commit — which
means `Esc` discards. That flips the panel from the settings-panel idiom to the
**picker idiom** (Helix's completion prompt is exactly three-state: `Update`
previews, `Abort` reverts, `Validate` commits).

**Second correction — Lee's own, and it resolves a hole in the first.** If
`Enter` closes, how do you exit after setting *both* slots? Pressing `Enter`
would commit a constant and wipe the pair you just built. His answer: **`Enter`
does not close. `Esc` is the only way out.**

### Decision

- **Arrowing previews only.** The app re-themes live behind the panel; nothing is
  written.
- **`Enter` commits a constant** (`theme = <selection>`). Panel stays open.
- **Slot keys commit to the dark or light slot.** Panel stays open — building a
  pair is inherently two selections.
- **`Esc` closes.** Anything committed persists; an uncommitted preview is
  discarded and the previously persisted theme is restored.

Every write is an explicit keypress; nothing writes on close. This also
eliminates the *"applied but not persisted"* state research flagged as reachable
under persist-on-close — where Portal dies with the panel open and the
visually-applied theme was never written.

Cost accepted: the common case ("pick one and go") is two keys rather than one.
Bought uniformity — one exit key, no dual-purpose keys, and the pair flow needs
no special case.

**Mutual exclusion.** Committing a constant clears the slots; assigning a slot
clears the constant. Whichever was set last wins. This also answers "what if both
a constant and a pair are present" — that state cannot exist.

### Partial pairs — an unset slot holds the shipped default

Lee's question: if you set dark and no light, do you have to set both? What
renders in a light terminal?

**Answer: you never have to set both, because a slot is never empty.** The
adaptive form always has two slots; the shipped values are their *defaults*. So
`"theme_dark": "nord"` yields `{light: tokyo-night-day, dark: nord}` — light is still the
shipped default because it was never overridden. There is no incomplete-pair
state to validate, explain, or render around.

This makes the shipped default and a partially-overridden pair **the same
mechanism** rather than two, which is why it beats the alternatives. Zellij's
rule (set only one slot and the static theme stays authoritative) doesn't
transfer — mutual exclusion means no static theme survives once a slot is set.
"Must set both" would need an invalid intermediate state plus something to render
during it.

Consequence for the panel: it can show both slots' current values at all times,
including ones never touched — you can see what light is set to without having to
remember whether you set it.

**Parked for the mockup:** research settled a marker for the theme active when
the panel opened, but under a pair there are potentially *two* markers (one per
slot) plus a different shape for a constant. Visual question, not a logic one.

### The mixed-mode flash, and list order

Under split + apply-on-arrow, arrowing past a light theme in a dark terminal
flips the entire canvas near-white and back. With three built-ins, one of three
rows does it, every time it is passed. Research could not have reasoned about
this — under paired, arrowing could never change the canvas mode.

**Accepted as correct behaviour, not a defect.** Lee: *"the flash isn't a bug,
it's the feature."* Seeing a light theme as designed is precisely what
live-preview is for, and under the picker idiom it is transient and reversible
(`Esc` restores), which is far milder than a persisted flip.

**List order is alphabetical.** Ordering same-mode themes first was proposed as a
free mitigation — it would turn the surprise into a deliberate act — and
**rejected**: unnecessary once the flash is accepted as the feature.

That keeps the earlier "no variant concept" decision fully intact. Ordering would
have required Portal to derive each theme's mode from canvas luminance; with the
mitigation rejected, the variant concept has **no consumer anywhere** — nothing
declared in the file, nothing derived at load.

### Opening the panel — `t`, on Sessions and Projects

**Key: `t`.** Free on Sessions (taken there: `/ s x m k d e r ? Space Enter Esc`
plus arrows) and the obvious mnemonic.

**Pages:**

- **Sessions** — yes; the default page and the richest surface to preview
  against.
- **Projects** — yes. Theme is a *global* setting; refusing would make it feel
  page-scoped for no reason, and `t` is free there.
- **Preview** — **no.** The preview body is captured real ANSI scrollback that is
  deliberately out-of-theme, so live preview would only re-theme the frame
  chrome — a weak surface. It is also already a full-screen overlay, so the panel
  would stack an overlay on an overlay. `Esc` out and change it.
- **Modals** — no; modals are key-exclusive by design.

**Considered and ruled out:** research noticed a latent question about what a
"settings surface" in Portal is — after this work `prefs.json` holds exactly two
things, grouping mode (changed by the `s` key cycle) and theme (changed by a
panel). Making the slide-over a general settings panel that also swallows
grouping mode would resolve that inconsistency, but `s` is fast and good, and it
is scope creep on an already-large feature. Two mechanisms for two prefs is a
mild inconsistency worth living with.

### Every theme file gets a row — invalid ones shown, not selectable

**This supersedes the count-line decision below**, and deletes work rather than
adding it. Lee's proposal: *"not showing incorrect themes [is wrong] … render
everything in the theme directory if it's a theme file. If it's invalid, show it
as invalid and don't allow it to be selected … you can actually see 'oh, there's
my theme, it has been registered, but it's invalid', rather than it just not being
there at all and you being completely in the dark about why."*

Strictly better on the same problem: the row is present and named, instead of a
count that sends the user to another command to discover which file and why.

**It also dissolves the review's F10 entirely.** There is no "persisted theme has
no row to mark" case any more — every file in the directory has a row, so an
unresolved persisted slug is listed, marked, and shown invalid. The marker keeps
meaning "this is what's persisted", and nothing implies the fallback was chosen.
The same holds per-slot under an adaptive pair with one broken slot.

And it improves the case the charset rule handled badly: a file with a **bad
name** (`My Theme.theme`) was going to be silently skipped; now it is a row
showing the filename with `bad name` as its reason.

**Shape:** enumerate every `*.theme` file; each gets a row; valid rows are
selectable; invalid rows render in `text.faint` with `⚠` and a terse reason
(`missing tokens`, `bad colour`, `bad name`) — glyph-backed per §2.2 so it
survives colourless. Arrow keys skip invalid rows, reusing the mechanism that
already skips group-header rows on the Sessions list. Full detail stays in doctor,
where there is width to enumerate.

**The fourth panel fixture becomes an invalid-theme row** rather than a
skipped-count line.

### Amendment — the list is files ∪ whatever prefs names (the review's F1)

"Every theme file gets a row" was said to dissolve the no-row-to-mark problem
*entirely*. It does not: it covers a file that exists but fails validation, and
not the three cases the missing-from-disk decision enumerates (deleted file,
renamed file, typo in `prefs.json`), nor the case where the persisted slug fails
the charset check and is rejected before any file is sought. No file means no row,
so nothing carries the `●` — yet that decision claims the failure surfaces "via
the slide-over". The two were decided an hour apart and did not compose.

**Amendment: the panel lists the union of files found *and* whatever `prefs.json`
names.** A persisted slug with no file gets a row too — marked, unselectable,
reason `not found`. Same shape as an invalid file: the user sees what is set and
why it is not applying. Applies per-slot under an adaptive pair with one dead
slug.

### On-ramp — `portal theme export` (the review's F2)

**Structural gap.** *"Copy a built-in and edit it"* carries **two** decisions — it
is the pro that justified `go:embed`, and the deciding factor that rejected
merge-over-a-base (full replacement is only cheap if copying is cheap). But
built-ins live inside the binary; `portal theme list` and `--theme` were ruled out
as YAGNI; nothing dumps an embedded theme; and an absent `themes/` directory is
deliberately silent, so Portal never creates or seeds it. The only remaining route
was finding the file on GitHub — never named as the workflow, and unavailable
offline.

**Decision: add `portal theme export <slug>`**, writing the embedded theme to
stdout, so the whole workflow is
`portal theme export nord > ~/.config/portal/themes/nord-lee.theme`. Plus a
complete copy-pasteable example theme in `docs/theming.md` for the no-terminal
case.

**This partially reverses the earlier YAGNI ruling, deliberately.** That ruling
was about *listing* and *selecting* — both genuinely redundant with the panel.
Export is redundant with nothing.

Considered and rejected: a panel key duplicating the highlighted theme into
`themes/` as `<slug>-copy.theme`. Better placed (on-ramp at the point of intent)
but adds a key and makes the TUI write files; the verb is simpler, scriptable, and
works when the panel is unavailable.

*(Related and accepted: because built-in rows are deliberately indistinguishable
from drop-ins, the reserved-slug set is not discoverable from the UI — a user
learns a slug is reserved by having their file rejected with a message naming the
conflict. `portal theme export` and the docs both make the set discoverable
outside the panel.)*

### No unset — accepted (the review's F14)

Every panel action *sets*: `Enter` sets a constant, slot keys set a slot, nothing
clears. So returning to the shipped pair after setting `theme_dark = nord` means
explicitly setting `tokyo-night` — which resolves identically today but converts
an **inherited default into a pin**, so a future change to the shipped default
would no longer reach that user.

**Accepted and documented rather than fixed with a clear key.** It only bites if
the shipped default changes, and `prefs.json` is hand-editable. Recorded as a
deliberate acceptance, not an oversight.

### No runtime floor under the fallback — a build-time guarantee instead

The orchestrator proposed a compiled-in last-resort palette (equal to Tokyo Night
Dark) for the case where the *fallback built-in itself* fails to load, on the
grounds that every fallback path terminates at a built-in and nothing sat beneath
it.

**Rejected, in favour of making the situation impossible.** Lee: *"we need to
ensure that we can't build this if the fallback doesn't render … that needs to be
impossible."* That is better engineering — a build-time guarantee beats a runtime
crutch.

- **A unit test parses and validates every embedded built-in, *and* asserts that
  every fallback slug and the shipped default pair resolve within that set.** Both
  halves are needed — see the amendment below; validating the files alone leaves a
  renamed file or typo'd constant undetected. It promotes what was
  recorded as a passing mitigation under the `go:embed` decision into a
  load-bearing requirement.
- **No runtime fallback-to-hardcoded-values.** With no path pretending to handle
  it, a binary somehow shipped with a broken default fails **loudly at startup**
  rather than limping on values nobody chose. `main.go` already owns a
  panic-recovering exit with a `process: panic` lifecycle marker, so that is a
  *marked* termination, not an unhandled crash.

### Construction timing under the adaptive default (the review's F1)

Three decisions each assumed the active theme is known at a moment the others said
it is not: plumbing has the model holding the active `Theme`; lazy discovery does
*one* file read by name at startup; detection says a two-slot user's light/dark
resolves **after** `Init`, when the OSC 11 reply or the 50ms timeout lands. Since
the shipped default **is** the adaptive pair, the common path constructs the model
before the slot is known — and every available answer was bad (defer the read onto
the first-paint critical path, or paint dark and flip, which the same paragraph
forbids).

**Decision: construction loads every *nominated* theme — at most two.** The gate
then only **selects** between values already in hand: no file read on the critical
path, no flip. The cold-path cost is one read for a constant, two for a pair.

This also completes the mid-session constant→adaptive transition: that dissolved on
the grounds that the OSC 11 *answer* is already in hand, but the other slot's
*file* would not have been read at construction (a constant nominates one theme).
Assigning a slot therefore reads that slot's file at commit time — a keypress-time
read, already the panel's cost model.

### The translation's trigger — an explicit marker (the review's F2)

The translation was justified as *"self-disarming: once theme keys exist the
condition can never fire again"* — written when the decision was to **drop**
`appearance`. The downgrade reversal kept the field without revisiting that claim,
leaving the disarm resting entirely on theme keys remaining present forever.

That composes badly with the "no unset" acceptance, whose documented escape hatch
is to hand-edit `prefs.json`: an upgraded user who deletes their theme keys to
return to the shipped adaptive pair gets **silently re-translated and re-pinned**
on the next launch — Portal reinstating exactly what they just undid.

**Decision: gate the translation on an explicit `theme_migrated` marker**, not on
the absence of theme keys. `appearance` is retained for downgrade, deleting theme
keys does nothing, and the trigger fires exactly once ever.

**Accepted:** the retained `appearance` is a frozen legacy value and is **not** kept
in sync with later panel commits. A downgraded binary honours the user's old pin
rather than their current choice — which is the most a binary with no concept of
themes could do.

### The build-time guarantee must cover the slugs (the review's F3)

*"A unit test parses and validates every embedded built-in"* proves the **files**
are good, but the fallback is three hardcoded slug constants (`tokyo-night`,
`tokyo-night-day`) resolving *into* that set. Rename a built-in file in a later PR,
or typo a constant, and every embedded theme still validates while **every fallback
path becomes unresolvable** — and with no runtime floor by decision, the consequence
is a loud startup failure.

**Decision: the test also asserts that every fallback slug and the shipped default
pair resolve** within the embedded set. That is the guarantee Lee actually asked
for — *"we can't build this if the fallback doesn't render"*.

### Enumeration timing — re-read on every open (the review's F12)

Lazy discovery said "enumerate when the slide-over opens" without saying whether
that means once per process or per open.

**Decision: re-read on every open.** It is a directory read of a handful of small
files behind a keypress — imperceptible against the keypress itself — and caching
buys nothing measurable while breaking the loop the drop-in route exists for
(copy a built-in, edit it, see it, without relaunching Portal).

**This also corrects a bad reason given earlier.** `fsnotify` was rejected partly
on *"you cannot edit a theme file while looking at Portal"* — which is false,
since Portal's own burst puts several windows on screen and an editor would
naturally be in one. The rejection stands on better grounds: Portal does not need
to *watch* the directory, it needs to not *cache* it. Re-reading on open gets the
same result with no watcher, no event path, and no mid-session surprise where the
list changes under the cursor.

### Rejection surfacing — count in the panel, detail in doctor (the review's F3)

> **SUPERSEDED in part** — the panel's skipped-count line is replaced by listing
> every theme file with invalid ones shown in place (see above). The
> split-by-surface principle and the doctor/log halves stand.

Four decisions lean on "the rejection surfaces inside the slide-over" — the
audience decision (auto-discovery makes validity user-visible), no-shadowing
(*"loud rather than silent"*), whole-theme rejection (*"naming the exact missing
tokens"*), and hex-only validation (*"one honest message"*). None of them
designed it, and the settled panel makes it awkward: **an invalid theme is absent
from the list**, so there is no row to attach a message to, and the panel is
~24–30 columns and degrades narrower. *"theme `nord-lee`: `text.primary` =
`#GGGGGG` is not a valid colour"* does not fit that, nor does enumerating six
missing token names, and N invalid files multiplies it.

**Decision: split the job by surface rather than forcing the panel to diagnose.**

- **The panel carries the *count*, not the detail** — a single line beneath the
  list, e.g. `⚠ 2 theme files skipped`. Enough to tell the user their file did
  not appear and it is not their imagination. Fits 30 columns, is constant-size
  regardless of N, and needs no per-token enumeration.
- **`portal doctor` carries the detail** — already decided as the theme health
  line, has full terminal width, works on the exec path, and enumerating
  *"theme `nord-lee`: missing `text.primary`, `bg.subtle`; `state.red` =
  `#GGGGGG` invalid"* is exactly what a diagnostic line is for.
- **The `theme` log component carries the forensic trail** — already decided.

Each surface gets the job its shape suits, and the panel needs no design that
fights its own width. Accepted cost: one extra step (see the count, run
`portal doctor`) for something that only happens when a hand-written file is
broken.

**Implies a fourth panel fixture** — the skipped-count line — added to the
capture set alongside adaptive-pair, constant-while-previewing and narrow
degraded.

### Input routing while the panel is open (the review's F8)

The panel was established as *not* a modal — it does not blank — and modals were
cited as key-exclusive by contrast. But blanking is a **rendering** property and
exclusivity is an **input** property; the discussion never said which applied.

**Decision: the panel is key-exclusive.** It owns arrows, `Enter`, the slot keys
and `Esc`; everything else is swallowed. Pass-through is genuinely bad — `k`
would kill the highlighted session while you pick a theme, `x` would swap to
Projects with the panel open, `m` would start a multi-select behind it.
Non-blanking and key-exclusive are not in tension: seeing the list without being
able to drive it *is* the live-preview premise.

**Entry conditions (the review's F9).** Settled: **nothing blocks `t` except a
modal and a pending burst.**

- **Multi-select** — `t` opens, and the marked set is **unaffected**. The panel
  *nests* over the mode and `Esc` resolves innermost-first (closing the panel and
  returning to multi-select with selections intact), which is not a new rule — it
  is what §8.1 already specifies for modals. The multi-select banner sits in the
  notice band on the left, so it stays visible behind the panel. Lee's reason for
  wanting this is a good one: *"it might be that I want to see what the theme
  looks like when I'm multi-selecting"* — the marked-row `●` is itself themed, so
  previewing mid-selection is legitimate. Blocking `t` here was considered and
  rejected as inventing a restriction to avoid a question the codebase already
  answers.
- **A pending burst** — `t` is swallowed. The burst input-locks the model (only
  `Ctrl-C`/`Esc` live) because it is mid-async-operation; swallowing is consistent
  with that lock rather than an exception to it. Lee: *"a pending burst shouldn't
  allow any type of key behaviour, but it's all quite quick, so it'd be weird for
  that to work anyway."*
- **Modals** — capture keystrokes, so no `t`, per existing key-exclusivity.
- **Sessions and Projects normal view** — always available.

*(Adjacent, and not a contradiction: `t` is separately blocked under `NO_COLOR` —
that is an environment capability question, not a UI-state conflict. "Never
blocked" here means by other UI states.)*

Two consequences:

- **`t` needs the filter carve-out** — while `/` is focused it is a literal
  filter character, exactly as `s` already is.
- **The keymap descriptor gains a `t` row** on Sessions and Projects, because
  `keymap.go` single-sources both the footer and the `?` help and
  `keymap_dispatch_guard_test` guards descriptor↔dispatch drift. It is added as
  a **non-core** entry — present in `?` help, absent from the footer. Sessions
  already carries seven footer entries and §2.7 degrades the footer as width
  shrinks; `t` is an occasional settings action, not a per-session one like
  attach or filter, so buying it footer space would cost a more useful entry on
  narrow terminals.

### Two undefined transitions (the review's F9)

**Committing to a slot that is not the active one.** Previewing a light theme in
a dark terminal and pressing `l` writes the light slot, but the resolved-active
theme is still the dark slot.

**Decision: commit changes nothing on screen** — it is a write, not a
navigation. The panel keeps previewing whatever the cursor is on; the display
resolves from persisted state only on close.

That also sharpens `Esc`, stated loosely earlier as "restores the previously
persisted theme". Precisely: **`Esc` discards the preview and renders the
resolved persisted state** — which equals "what you had before" only when
nothing was committed. Commit slots and `Esc` lands on the newly-resolved theme,
which is correct.

**Constant → adaptive mid-session.** This looked like a real problem: a
constant-theme user's launch deliberately skips the detect-or-timeout gate, so
assigning a slot converts them to adaptive in-session and needs a light/dark
answer this launch never waited for.

**It dissolves.** `restore.go` issues the OSC 11 query from `Init` **regardless**
— it needs the original background to restore on exit, independent of detection,
and that survives every decision made here. The terminal's background is
therefore already in hand; the detection decision only ever governed whether to
**classify and use** it. Converting to adaptive mid-session starts using an
answer that already arrived: no new query, no race, no gate.

The startup win survives intact — skipping the gate for constant users is about
not **blocking first paint**, not about not asking. If the reply has not landed
(requiring the panel to be opened within milliseconds of launch) it falls to
dark, the same rule as everywhere else.

### `NO_COLOR` — block the panel (the review's F10)

Under `NO_COLOR` Portal paints no canvas, imposes no hues, and renders
glyph-backed on the terminal's native fg/bg. So a theme panel previews nothing,
its cursor tint and slot dots have no colour, and committing persists a choice
with zero visible feedback.

**Decision: `t` is blocked under `NO_COLOR`, with a flash**, following the
multi-select precedent exactly — `m` is proactively blocked at entry on an
unsupported terminal rather than letting the user walk into a dead end, with a
flash and its help row filtered out via the `sessionsHelpKeymap()` call-site
filter. The `t` row is filtered the same way while blocked.

This is deliberately the **opposite** call to the narrow-terminal one. Narrow is
a *space shortage*, where §2.7 mandates degrade. `NO_COLOR` is a *capability
absence* — there is no colour to theme, so the panel's purpose is inert rather
than cramped.

**Counter recorded rather than buried:** someone may run `NO_COLOR` in one
context and not another, so blocking prevents setting a theme that *would* apply
elsewhere. Accepted, because the escape hatch is now first-class — `prefs.json`
is the documented hand-editable home for the theme setting, so three keys can be
set by hand. Judged a fair trade against a panel that appears to do nothing.

**Guard consequence:** colourless fixtures are **excluded** from the swap-and-diff
test. A colourless render contains no theme hexes, so there is nothing to diff —
their inclusion would be meaningless rather than merely redundant.

### The panel re-themes too (the review's F2)

Never stated: does the slide-over's own chrome re-theme with the previewed theme,
or stay anchored to the persisted one? Both readings bite. Re-theming means its
border, cursor bar and slot dots change on every arrow — and since a drop-in need
only be *valid*, not good, a legal-but-awful theme could render the panel's own
list and `esc close` hint unreadable while the user is standing on it. Not
re-theming makes the panel the one surface holding non-current colours while
everything behind it swaps, which also means it legitimately retains theme-A
hexes and would need carving out of the swap-and-diff guard.

**Decision: everything re-themes, panel included. No exceptions.** Lee: *"yes
everything rethemes."*

Reasons, ascending:

1. It is the honest preview — the panel is part of what the theme paints, so a
   fixed panel shows a theme that cannot be fully judged.
2. It avoids a **permanent exception in the render layer** — a surface that
   deliberately ignores the active theme is precisely the shape the completeness
   guard exists to catch, so the alternative would mean carving out the one test
   protecting against accidental carve-outs.
3. The unreadable-panel risk is smaller than it looks, because **`Esc` is a
   keypress, not a visible affordance** — no need to read the hint to close the
   panel. The picker idiom does the rest: `Esc` discards the preview and lands
   back on the prior theme.

**Residue recorded rather than hidden:** a user can only get *stuck* in an
unreadable theme by explicitly committing one, and the recovery is then editing
`prefs.json` rather than anything in the UI. Since a drop-in is by decision the
user's own creation and only they can reach this state, that is judged
proportionate — but it is a real edge.

### Panel geometry — degrade, don't refuse

**Width.** Fixed preferred width (~24–30 columns: name, markers, slot
indicators, border, padding), with long user slugs truncated `…` as Portal
already does for session names. A fixed width is predictable to lay out against;
content-driven width would make the panel jump around as the library changes.

**Narrow terminals — the orchestrator's first proposal was wrong.** It suggested
*refusing to open* below a threshold of "panel width + the app's documented
40-column minimum", citing the multi-select precedent (`m` is proactively blocked
at entry on an unsupported terminal with a flash, rather than letting the user
walk into a dead end).

Lee pushed back: *"it would have to be very narrow for that to be the case. Like
on a mobile, I would still expect it to open."* He is right, and there is a
principled reason the precedent doesn't transfer: **multi-select is blocked
because of a capability *absence* — the terminal genuinely cannot spawn windows.
A narrow terminal is a space *shortage*, and §2.7's doctrine for space shortage
is explicit: degrade, never break.** Refusing on width would contradict Portal's
own established stance.

So:

- The panel **shrinks** between a preferred and a minimum width as the terminal
  narrows — staged degradation, consistent with §2.7's existing width steps
  (drop right-side header hint → compact wordmark → truncate names).
- It **refuses only when even the minimum panel cannot render**, which is very
  narrow indeed — and then it flashes rather than opening a broken frame.
- Exact thresholds are pinned at implementation, as §2.7 already does for its
  own degradation steps.

**What the panel covers.** Overlay hides the right-hand column, where the
footer's right-aligned `? help`, the right-side header hint, and session row meta
live. **Accepted** — and for a better reason than transience: the theme is
carried almost entirely by the *left* of the screen (session names, cursor bar,
group headers, footer key glyphs), while the right edge is metadata. The overlay
covers the least theme-informative part of the screen, which is exactly what a
preview surface wants.

### Precedent — mixed, and honestly thin in one place

For the picker itself it is strong: Helix's `:theme` re-themes live without
restart behind a three-state prompt; Ghostty's `+list-themes` is close to the
described layout (list one side, live preview the other, `Esc` to exit, `f`
cycling a light/dark filter); kitty's themes kitten has live preview and a
recently-used list.

For **assigning a theme to a light/dark slot from inside a picker, nothing was
found.** Helix, Ghostty, Zellij, kitty and bat all require editing config for the
pair. The slot keys are genuinely novel — not a reason to avoid them, but the
reason a Paper mockup earns its keep, since there is no established shape to
borrow.

### Paper spike — two marker/slot treatments

Two artboards added to the **Portal** Paper file, both built on the canonical
`Sessions — Modern Vivid v2` frame so they inherit the shipped MV conventions
(JetBrains Mono, 32px rows, `#0B0C14` canvas, `#28243A` selection tint,
`#BB9AF7` cursor, panel chrome `#0C0C16` on `#2B3050` border):

- **`Theme slide-over — A (inline slot badges)`** — slot assignment shown as a
  right-aligned `dark` / `light` badge on the assigned rows.
- **`Theme slide-over — B (assignment header)`** — a `dark → … / light → …`
  key-value block pinned under the panel header, with a plain list below.

Shared decisions expressed in both frames:

- **Full-height, flush to the right edge, left border only** — deliberately
  *not* an inset bordered panel like the modals, so it reads as a slide-over
  rather than a floating dialog.
- **Non-blanking overlay.** The Sessions list stays fully visible; the panel
  covers the right column, which visibly costs the footer's `x projects` and
  `? help` — exactly the accepted trade recorded above.
- **Vertical keymap footer** (`⏎ set theme` / `d set as dark` / `l set as light`
  / `esc close`) rather than Portal's horizontal footer row — a horizontal keymap
  does not fit a ~30-column panel, and the vertical form matches the help
  modal's key-column idiom.
- **Cursor row** uses the shipped selection treatment (`▌` + tint + white bold
  name), so the panel's list reads as the same kind of list as Sessions.
- The list shows a **user drop-in theme** (`nord-lee`) sitting alphabetically
  among the built-ins, with no visual distinction — deliberate, matching the
  decision that a valid drop-in is simply selectable.

**Treatment chosen: A.** B's assignment block is more legible at a glance, but it
puts theme names in a second place, pushes the list down, and with only two slots
the badges say the same thing without the extra region. A also scales better as
the library grows, since a badge stays attached to the row it describes. Lee's
accepted caveat: with a very long list the assignments could scroll out of view —
judged fine, since a user knows what they picked and can scroll to find it.

**The `●` was restored, and the reasoning for dropping it was wrong.** The spike
removed the badge's leading `●` on the grounds that the glyph already means
*attached* in the sessions list. Lee corrected this: Portal **already
repurposes** `●` for multi-select marking, where it indicates a marked row rather
than a live session. So `●` is Portal's general "marked / active" glyph, not an
attached-only one, and using it for slot assignment is consistent with existing
practice rather than a collision. The two signals stay independent: `●` marks
*assignment*, the `▌` + tint cursor treatment marks *browse position*.

One refinement that stood: the panel header dropped a theme count (noise at this
list size).

### The constant state — third frame

`Theme slide-over — A (constant set, previewing another)` completes the panel's
specification, since the two setting states never coexist on screen: it shows a
**constant** theme (`nord`, carrying a bare `●` with no slot word, exactly as
multi-select marks a row) while the **cursor sits on a different theme**
(`tokyo-night`, which the app behind is therefore rendering).

That combination is the picker idiom made visible: the `●` is what is
*persisted*, the cursor + canvas is what is *previewed*, and `Esc` would restore
the marked one. It is also why the bare `●` is sufficient — with no slots there
is nothing to qualify, and the label would be redundant with the marker.

### Sequencing — model first, then mock

Agreed to settle the interaction in words before mocking, so the Paper frame
expresses a decided model rather than exploring one. The panel still has
undecided structure that changes the frame (width, what sits behind it,
narrow-terminal behaviour, whether it opens from pages other than Sessions). The
frame then becomes the reference artifact carried into spec and planning.

---

## Theme plumbing — swap `mode` for the theme

### Context

Research called this the feature's one real architectural tradeoff: `theme.MV` is
a package-level global read directly at **182 call sites**, so making the active
theme switchable meant choosing between

- **mutable package state** (`theme.Active` var + setter) — near-zero call-site
  churn, but package-level mutable state on the render path, and render becomes
  order-dependent on the setter; or
- **explicit plumbing** — pass a `Theme` down through the renderers; idiomatic
  and test-friendly, but a large mechanical change plus a third parameter on
  every render helper that already threads `mode` and `colourless`.

### The split decision dissolved the tradeoff

Every call site reads `headerStyle(theme.MV.TextPrimary, mode, colourless)` — and
**split removes the `mode` parameter**, because a theme no longer has variants to
resolve between. So all 182 sites are being edited regardless, and a parameter
slot is freed at exactly the same moment.

That guts the case for mutable global state: its entire advantage was avoiding
churn Portal is now paying anyway.

### Decision

**The model holds the active `Theme` and passes it where `mode` is passed
today** — a straight substitution of one threaded value for another, in code
already being touched. No package-level mutable state, no new parameter.

Secondary benefit that matters in this codebase specifically: a test can
construct a model with any theme instead of mutating a global and hoping nothing
else observed it. The suite already forbids `t.Parallel()` because the cmd
package injects mocks via package-level mutable state — adding another global
would push in the wrong direction.

---

## Live-swap mechanics

### Speed is a non-issue, and "bake in on exit" is rejected

Research verified the cheap path already exists and already excludes the
expensive one:

- **Restyle** — `applyCanvasMode` swaps the delegate and re-points the cached
  style structs `bubbles/list` holds. O(1), no I/O, no list content touched. It
  is already exercised in production: it is what runs when the OSC 11 reply lands
  after first paint.
- **Rebuild** — `rebuildSessionList` re-derives the item list and, in grouped
  modes, runs the lazy dir-resolution pass with its per-session tmux pane reads
  (the known ~0.5s By-Project cost at ~38 sessions).

**`applyCanvasMode` does not call `rebuildSessionList`.** So the original ask —
"take the shortest path to updating colours, defer heavier work to panel exit" —
needs no deferral mechanism: nothing heavy is on the path.

The premise that the re-render is the cost is also wrong. Bubble Tea rebuilds
the whole view string on *every* keypress regardless, diffs it, and writes only
changed cells — holding the down arrow in the sessions list already does this
dozens of times a second. A theme swap costs one ordinary keypress plus the
style re-point.

**"Bake in on exit" is therefore rejected**: nothing is left un-baked, and
deferring work to panel close would create a visible discontinuity at the one
moment that should be seamless.

### The real risk is completeness — guarded behaviourally

Threading the theme (above) fixes most of this: anything taking the theme as a
parameter re-derives per frame. What remains is the **cached styles Portal does
not own** — `bubbles/list`'s help styles, pagination dots, TitleBar, and both
filter inputs — which are assigned once. That list is **hand-maintained with no
guard test**, unlike the colour-literal rule which has an AST glob guard. Miss a
site and the element silently keeps the previous theme's colours until something
else re-renders it.

Two specific offenders research already found: `pagepreview.go:35` copies a
`Token` at **package init**, so it would never see a swap; and init-time copies
of *derived styles* were never swept for at all.

**Decision — a behavioural guard, not a structural one.** Render every capture
fixture under theme A, swap to theme B, render again, and assert **no theme-A hex
survives** in the output. The offline capture harness already renders every
canonical screen deterministically through the shared `tui.Build` constructor
with every tmux seam faked, so the fixture list *is* the coverage list, and it
grows automatically as screens are added.

This beats a structural guard because it catches *any* missed site — including
ones added years later — without anyone having to remember a rule. A structural
guard would have to recognise "this is a cached style" in the AST, which is not
mechanically well-defined.

The two known offenders are fixed outright rather than guarded around: the
package-scope `Token` copy goes, and `canvasHexFor` stops referencing `theme.MV`.

Confidence: **high on the approach; Lee deferred to the recommendation** rather
than holding a position ("whatever you think there is the right thing to do").

### OSC 11 re-emission and the canvas-echo guard

- **No per-keystroke churn.** Bubble Tea v2 **diffs** the view's background
  colour and emits only on change (`cursed_renderer.go:411-432`), so hovering N
  themes emits OSC 11 exactly once per *distinct* canvas landed on — the minimum
  the feature requires. The declarative per-frame `BackgroundColor` assignment is
  not a per-frame write.
- **The echo guard needs no new race handling.** It exists because the startup
  OSC 11 *query reply* can race Portal's own canvas set. The query is issued once
  from `Init`; a later theme switch issues no new query, so it creates no new
  race. The guard only ever needs to compare against the canvas active during the
  *startup* window.
- **But it does need work**, and it lands on the one mechanic carrying an
  explicit "do **not** drop this guard" warning: `RestoreTerminalBackground`
  currently derives its comparison value *at exit* from `m.canvasMode` via
  `canvasHexFor`, which reads `theme.MV.Canvas` **directly** — a hardcoded MV
  reference outside the token render path. Anchoring to the startup canvas means
  capturing and retaining that hex as model state, and making `canvasHexFor`
  theme-agnostic.

### Concurrent Portal instances (the review's F12)

Portal's multi-window burst routinely produces several concurrent processes, so
multiple live instances are normal rather than an edge case. Behaviour under the
decided design: each instance loads its theme at construction; an instance that
changes theme persists it; other instances are unaffected until relaunch (there
is no file watch — discovery is lazy, and `fsnotify` was rejected). `prefs.json`
is last-write-wins.

**This is exactly how `session_list_mode` already behaves** — the `s` toggle
persists per-instance with no cross-instance sync, via the existing
`ModePersister` seam that a theme persister follows. No new hazard, no new
mechanism.

---

## Non-TUI surfaces, logging & docs

### `portal doctor` — a read-only theme health line

Doctor is Portal's established config-health surface and the **only** surfacing
route that works on the `portal open <target>` exec path, where the picker never
renders and no in-TUI message would ever be seen. It:

- scans the themes directory and reports any file failing validity, with the
  reason;
- reports when the persisted theme name no longer resolves.

**Read-only, with no `--fix` action.** Doctor can prune a stale hook entry;
it cannot repair someone's colours.

**Advisory — theme lines do not drive the exit code (the review's F11).**
Doctor's contract is a scriptable exit code, 0 iff all checks pass, and because
there is deliberately no repair path a failing theme line would go
**permanently** non-zero until someone hand-edits a file — unlike every other
check, which is either `--fix`-repairable or indicates genuine runtime breakage.

The exit code exists as a signal about the **resurrection machinery** — daemon
alive, hooks registered, state sane. A stray junk file in `themes/` is not that:
Portal is working, it simply did not list one theme. Letting it hold the
diagnostic red means an automated health check fires about the daemon because
someone left a half-written palette lying around.

So doctor gains **two classes of line**: *Portal-health checks*, which drive the
exit code as today, and *user-content diagnostics*, which report and do not.
Theme validity is the first member of the second class. **This amends the spec's
doctor contract** — flagged as a real change, not a detail.

Rejected: failing the exit code on the grounds that a user who dropped a broken
file into a Portal-read directory should get a loud persistent signal. They do —
via the panel count and the doctor line — without conscripting a signal that
means something else.

### Ruled out as YAGNI

- **`--theme` flag** — a third way to set a theme, for a single launch nobody
  asked for. (Note this was the escape hatch named in the *reversed* pre-canvas
  stance, so it arrives with no live constituency.)
- **`portal theme list` verb** — the slide-over lists them; doctor validates
  them.

### A new `theme` log component

Portal's log component taxonomy is **closed and spec-governed** — components are
never invented at a call site. `terminals.json` maps to the *empty* component
because "terminals" is not in the vocabulary, making it silent in `portal.log`.

**Decision: add a `theme` component** via spec amendment. Precedent is direct —
`spawn` and `resolve` were both added by the features that needed them, as
spec-governed amendments. Events worth recording: theme loaded, theme rejected
with reason, fallback applied.

What distinguishes this from `prefs` and `terminals` (both deliberately outside
the vocabulary) is that those are **dumb stores with no runtime behaviour**,
whereas the theme loader has parse/validate/fallback *outcomes*. It also closes
the gap the review raised as F10/F9 together: without a log component, a broken
theme on the exec path leaves **no trace anywhere**, since doctor is manual and
the slide-over never opens. Lee: *"logging is good because it helps diagnose
problems."*

### Upgrade path for an existing `appearance` value (the review's F4)

Real installs hold `"appearance": "dark"` or `"light"` today — the README
currently *recommends* pinning it. Deleting `prefs.Appearance` makes that field
unknown, so tolerant decode silently ignores it, and a user who deliberately
pinned `dark` on a light terminal upgrades into the shipped adaptive pair and
**silently gets a light Portal** with nothing explaining why. That is the worst
outcome for precisely the group who expressed a preference.

**The mapping is exact**, which makes the fix cheap: `appearance: dark` meant
"always dark regardless of terminal", and the new equivalent is a **constant**
theme.

**Decision: a one-shot translation on first run after upgrade.** If `appearance`
is `light` or `dark` **and** no theme keys are set, write `"theme":
"tokyo-night-day"` or `"theme": "tokyo-night"` and drop the field.
`appearance: auto` needs nothing — ignoring it lands exactly on the adaptive
default, which is what `auto` meant.

Intent is preserved precisely rather than approximately: a pinned mode becomes a
pinned theme, and detection stays off for them just as it was.

Portal has the precedent — `migrateConfigFile` performs a one-shot move from the
old macOS config path. It fires **exactly once ever**, gated on an explicit
`theme_migrated` marker (see the amendment below — an earlier version gated on the
absence of theme keys, which was re-armable). The `theme` log component records
it, giving a forensic trail with no user-facing interruption.

Rejected: accepting the silent flip as cosmetic and one keypress to fix — wrong
when the affected users are exactly those who set a preference, and when the
translation is this small and this exact.

### Correction — the exec-path justification was wrong (the review's F6)

Both the doctor line and the `theme` log component were argued partly from the
`portal open <target>` exec path: doctor as *"the only surfacing route that works
on the exec path"*, and the log component as closing a gap where *"a broken theme
on the exec path leaves no trace anywhere"*.

**That premise is wrong.** Under lazy discovery the theme is loaded at **TUI
construction**, and the exec path constructs no TUI — it resolves a target and
`syscall.Exec`s. So the loader never runs there, nothing themed is rendered, and
there is no failure to surface or record on that path at all.

**Both decisions stand; the reasoning is corrected:**

- **Doctor's theme line** earns its place as the *detailed, scriptable,
  on-demand* diagnostic surface — full terminal width, able to enumerate
  per-file reasons — not because of the exec path.
- **The `theme` log component** earns its place because a TUI launch that rejects
  a theme should leave a **passive** record. The panel's skipped-count is
  transient and only visible if the panel is opened; doctor must be invoked. The
  log is the only trail that exists without the user going looking.

**And a win worth recording explicitly:** the exec path does **zero** theme work
— no scan, no file read, no parse. On the path Portal is most careful to keep
free of cost, this feature adds nothing at all.

### Write-path robustness (the review's F8, F11, F13)

**The upgrade translation is a startup write (F8).** Resolution: separate
*computing* from *persisting*. At prefs load, read `appearance`, compute the
translated theme, and **use it in memory immediately**; the write is best-effort
and non-blocking. A failed write means Portal renders the correct theme this
launch and retries next launch (the condition is still true), so it can never
flip the user to the wrong theme — which was the translation's entire purpose.

Concurrency is a non-issue for a reason worth stating: several burst-launched
instances hitting the condition simultaneously all compute **the same value from
the same input**, so the write is idempotent and last-write-wins is harmless.
That is what makes it safe where a general read-modify-write would not be. It also
never runs on the exec path, which constructs no TUI and reads no prefs.

**The persisted slug needs the same charset validation as a filename (F11).** The
`[a-z0-9-]` rule was stated as applying to filenames *during enumeration*, but the
persisted value comes from a hand-editable file and is used to locate a file by
name on a path that deliberately does not enumerate — so `../something` would be
used as a path component. Stakes are low (the read fails validation anyway) but
the rule was in the wrong place: **validate the persisted slug against the same
charset before use**, and treat an invalid one as unresolvable — fallback plus
report, identical to any other unresolvable theme.

**The themes directory itself (F11).** Absent is the common case and **silent** —
zero drop-ins, not an error, no doctor line. Unreadable, or a regular file where a
directory belongs, gets a **doctor advisory line and a log entry**, being a
genuine misconfiguration rather than an absence.

**A failed commit write (F13)** reports inside the panel, keeps the theme applied
in memory, and **does not move the `●`** — the marker means "what is persisted"
and would be lying if it moved. This does recreate "applied but not persisted",
but as a *reported* state rather than a silent one, which is the distinction the
picker idiom was actually buying. The multi-field concern dissolves: `prefs.json`
already goes through `fileutil.AtomicWrite`, so all three keys land in one atomic
write and partial failure is impossible.

### Attribution, licensing and naming — deliberately not pursued (the review's F16)

Attribution was settled earlier: it lives in the repository (docs and README) and
explicitly **not** in the UI — no credits screen, nothing in the slide-over.

The review raised that attribution and *licensing* are different questions, since
the PR route compiles a stranger's port of a named palette into a
Homebrew-distributed binary, and Nord in particular ships with a deliberately
altered red under the palette's own name. The orchestrator proposed a per-theme
licence line, an "(adapted)" naming convention, and a PR contribution
requirement.

**Lee declined all of it** — *"it's not up to us to worry about licencing … they're
just 19 colours … you're worrying about nothing"* — for a project with essentially
one user and no reach.

**Settled: a source and a link in the docs, nothing further.** Ported palettes
keep their own names, adaptations need no naming marker, and there is no
contribution ceremony. Recorded so a future reader does not mistake the omission
for an oversight.

### Prefs writes, ownership and the log catalogue (the review's F3, F4, F5, F10)

**Downgrade — the field is no longer dropped (F10).** The translation was
specified as "write `theme` **and drop** `appearance`". But Portal ships via
Homebrew where reverting a version is routine, and the protected population is
exactly those who pinned `appearance` — so post-translation their pin is gone, an
older binary reads nothing, falls to `auto`, and resumes detecting: precisely what
the translation prevented, displaced in time.

**Decision: do not drop the field; only add the theme keys.** Inert to the new
binary, still meaningful to an old one — and it removes a schema mutation
entirely, which also removes the question of who owns performing the deletion.

**Ownership (F4).** Three decided constraints met here unreconciled: `prefs` is a
deliberate leaf that must not import `internal/log`; the translation happens "at
prefs load"; the `theme` log component records it. **`cmd/config.go`'s
`loadPrefsStore` owns it** — it already owns prefs path resolution and the migrate
breadcrumb for every other config file, and is not a leaf, so it can log. `prefs`
stays dumb.

**A stale whole-file write can silently revert a theme (F3)** — the real bug in
this cluster. Before this feature `prefs.json` had one field with a production
writer, so "concurrency is the same as `session_list_mode` today" was true. It now
holds four independently-mutated fields written from two surfaces. Instance A,
constructed ten minutes ago, presses `s` and writes *its* in-memory prefs,
silently reverting the theme instance B just committed. `AtomicWrite` does not
help — this is a lost update, not a partial write.

**Decision: read-modify-write.** Both writers re-read `prefs.json` immediately
before writing, mutate only their own field(s), and write the merged result. Not
novel — the project and hooks stores already do this for their own mutations.

**The `theme` log catalogue (F5)**, enumerated because the vocabulary is closed and
`spawn` set the precedent of shipping with its attr keys declared:

| Event | Level | Cadence |
|---|---|---|
| `theme: loaded` | INFO | one cycle summary per TUI construction (resolved slug + rejected count) |
| `theme: rejected` | WARN | one per rejected file (slug / reason / token) |
| `theme: fallback applied` | WARN | per fallback |
| `theme: appearance migrated` | INFO | one-shot |
| `theme: commit failed` | WARN | per failed write |

Attr keys: `slug`, `slot`, `reason`, `path`, `token`, `count`.

Rejections are **WARN**, not INFO: doctor treats them as advisory for *exit-code*
purposes, but "your config did not work" is a warning in a log.

### Log cadence, corrected for lazy discovery (the review's F4)

The catalogue gave `theme: loaded` as carrying a **rejected count** at TUI
construction — but under lazy discovery nothing is enumerated then. Corrected to
three events with distinct cadences:

- **`theme: loaded`** — at construction. Resolved slug(s) only, no count.
- **`theme: enumerated`** — at panel open. `count` and `rejected`.
- **`theme: rejected`** — per file, **deduplicated per process**: a given
  slug+reason logs once, so five panel opens (enumeration re-reads on every open)
  do not produce five identical WARN sets.

### `portal theme export` — command surface (the review's F5)

- **Bootstrap-exempt** — added to `skipTmuxCheck`. Printing a file must not start a
  tmux server, ensure the saver, or run restore, which every non-member of that set
  does via `PersistentPreRunE`.
- **Slug domain: built-ins *and* drop-ins.** Resolving both makes export a
  diagnosis tool — "show me what Portal parsed" — not just an on-ramp.
- **Output** is the theme in canonical form. An **invalid** drop-in is refused with
  its reason on stderr and a non-zero exit; an **unknown** slug likewise. Doctor's
  advisory-vs-health distinction is doctor's own contract and does not extend here.
- The `theme` verb group has only `export` for now, `list` having been ruled out —
  a one-member group, noted deliberately.

### Panel vertical axis (the review's F6)

Geometry was decided on width only, while the panel is full-height and the list is
the union of built-ins, every `*.theme` file, and whatever `prefs.json` names.

- **Overflow: scroll**, through the `bubbles/list` machinery, so `Ctrl+↑/↓` paging
  applies per §12.2. The invalid-row skip composes with paging exactly as the
  group-header skip already does on the Sessions list.
- **Minimum height: the same degrade-then-refuse rule as width** — shrink the
  visible row count, and refuse with a flash only when header + footer + one row
  cannot fit.
- **Resize while open: degrade in place**, closing with a flash only if the
  terminal falls below the render floor. The entry condition was never meant to be
  the only check, and §2.7's degradation is already per-dimension.

### The exit-time canvas restore needs its own test (the review's F7)

`RestoreTerminalBackground` must be re-anchored to a **retained startup canvas
hex** (new model state) with `canvasHexFor` made theme-agnostic. The swap-and-diff
guard scans *rendered fixture output*, so it structurally cannot cover an exit-time
OSC 11 write — the same blind spot that motivated the guard, reappearing on the one
path where a mistake re-sticks a colour in the user's terminal **after Portal
exits**. And this is the mechanic carrying an explicit "do **not** drop this guard"
warning.

**Named verification: a direct unit test on `RestoreTerminalBackground`**, driven
without fixtures, asserting it compares against the retained startup canvas and not
the active theme's — including the case where a theme was committed mid-session.

### MV's own erratum values — the check has an owner (the review's F10)

The method note raised that MV's corrected light values, described as *"darkened,
hue-preserved"*, may carry the same chroma flaw in the opposite direction. It was
left as a sentence with no owner, while sitting on the critical path of *"the
existing MV values move across clean"*.

**Owner: a task in this feature's implementation, before MV's values are frozen
into theme files.** Re-derive the six corrected light values in Oklab, measure
chroma loss, and give a **fresh visual gate** to any that moved materially.

**Flagged consequence:** if the check finds anything, shipped colours change,
`TestLightSurfaceTintsPinned`'s eyeball-established pins move, and "Tokyo Night
Dark/Light are just the existing values" stops holding exactly. The built-in-set
decision is therefore conditional on this check.

### PR intake is cheap for dark themes, not for light (the review's F11)

Two framings conflicted: the PR route as *"literally adding a file"* against
verification obligations attached to the same act. Correcting it plainly:

- **A dark theme is genuinely near-free.** Floor checks auto-enumerate the embedded
  set; no eyeball pins are involved.
- **A light theme is a design task with a human gate.**
  `TestLightSurfaceTintsPinned` becomes per-light-theme and its pins are
  established by human eyeball at a visual gate — which only Lee can perform, via
  `capturetool`, because Portal cannot be run from a temporary build.
- **There is no CI** (tests and lint run locally), so a contributor gets no signal
  that their theme fails a floor until the maintainer runs the suite.

**Consequence stated rather than inherited:** the deferred *"further light theme
follows up as separate work"* is a design task, not a file drop.

### Where the vocabulary lives (the review's F12)

After this feature the 19 roles are described in the MV spec, in
`docs/theming.md`, in that doc's copy-pasteable example theme, and in the embedded
`.theme` files.

- **`docs/theming.md` is the source of truth for the public contract** — the 19
  roles and their meanings.
- **The MV spec is amended by this feature's specification phase**, explicitly:
  the renames, 20 → 19, the dropped `border.footer`, the removal of
  `Token.ColorFor` / `theme.Mode`, and §2.9's two-hardcoded-canvas framing. Named as
  spec-phase work rather than left unowned. (§8.1's stale "2-tone border" claim goes
  with it.)
- **The example theme is covered by the same doc guard** — it must parse and contain
  all 19 keys — so it is not a fourth unguarded copy.

### PNG production is no longer optional (the review's F14)

The VHS-versus-direct-writer choice was left as an implementation detail *"on the
assumption the existing mechanism already works"* — but the retention decision
deletes the tapes that made it work, while the harness requirement is that **every
fixture can produce a PNG** (without which the agent cannot review its own output).

**Corrected: direct PNG output from `capturetool` is required, not an
optimisation.** VHS is retained only if a gif is ever wanted for motion. Leaving it
open would have left the agent's self-review loop dependent on artifacts the same
section deletes.

### Footer keymap revision — discoverability (the review's F13)

The review asked whether the feature's near-invisibility was intended or the sum
of seven decisions each taken on other grounds: `t` non-core, `--theme` and
`portal theme list` both ruled out, the themes directory silent and never seeded,
built-in rows indistinguishable from drop-ins, the reserved-slug set invisible, and
no active-theme indicator when the panel is closed. Discoverability rested entirely
on `?` help and `docs/theming.md`.

**Lee's answer went further than promoting `t`:** drop `↑↓ navigate` from the
footer (arrows in a list are a given), and promote **both** `t` and `m` to core.

That inverts cleanly with the earlier `t` decision — arrows are the entry that
genuinely deserves non-core status (self-evident, still listed in `?` help), which
is the distinction applied to the right thing.

**Decided footers:**

- **Sessions** — `⏎ attach · / filter · ␣ preview · s switch view · x projects ·
  t theme · m multi` + right-aligned `? help`
- **Projects** — `⏎ new session · x sessions · e edit · / filter · t theme` +
  right-aligned `? help` *(verified against the `Projects (MV)` frame: it carries
  no `navigate` today and has ~322px of slack before `? help`)*

**Width, measured rather than assumed.** Dropping `↑↓ navigate` frees ~93px;
`t theme` costs ~61px and `m multi-select` ~116px, netting **+84px** against an
89px spacer at the mock's 86-column width — it fits with ~5px spare and no
headroom. **The label is therefore `m multi`, not `m multi-select`**, buying back
~47px. Decided here, not deferred.

**This amends spec §12.2** (the keymap revision) — the third spec amendment this
feature carries, alongside the doctor contract and the log-component vocabulary.

### Note — the MV Paper frames are historical, not specification

Recorded because it governs how everything above should be read. **Modern Vivid is
already implemented, so the code is the source of truth.** The MV Paper frames are
historical reference from that feature's design phase; a footer in them that no
longer matches (e.g. still showing `↑↓ navigate`) is **not** a defect and is not
worth updating. Lee: *"we don't need to update the paper frames … Code is the
source of truth."*

Only the **new** frames are forward-looking reference material, because they
describe surfaces that do not exist yet: `Theme slide-over — A (inline slot
badges)`, `Theme slide-over — A (constant set, previewing another)`,
`Theme slide-over — B (assignment header)`, `Sessions — Nord (port)`,
`Kill Modal — Nord (state.destructive #DD8188)`, and
`Sessions — Nord inline flash (bg.attention #3D4046)`.

A related caution surfaced while building them: the Paper mocks use **per-frame
literal hexes**, so the same token carries different values across frames (the
inline-flash frame's selection tint was `#1A1726` where the canonical Sessions
frame's was `#28243A`). That is exactly the drift the token layer prevents in
code — another reason the frames are reference, never truth.

### Doctor's advisory lines, visually (the review's F17)

Doctor renders one line per check with a pass/fail marker and drives a single exit
code, so an advisory line that *looks* failing while leaving the exit code at 0 is
a new reading for both humans and scripts.

**Decision:** Portal-health checks keep their existing pass/fail markers;
**advisory lines carry `⚠`**, reusing Portal's established warning glyph (§2.2,
glyph-backed so it survives colourless). Doctor's closing summary distinguishes
the two counts — e.g. *"N checks passed · 2 advisories"* — so the exit code's
meaning is legible without reading the contract.

### Docs

`docs/theming.md`, following the `docs/custom-terminals.md` precedent (a
user-authored config file with its own doc). Contents: the **19-token vocabulary
with each role's meaning** — the seed's own deliverable, and far more load-bearing
now the names are a public contract — the file format, the two-slot config, and
attribution for ported palettes (attribution lives in the repo and README,
explicitly **not** in the UI).

**README/CHANGELOG consequences.** `appearance` is described in `README.md` at
four places, including a paragraph recommending users pin it *"when
auto-detection misfires (for example under tmux passthrough)"*. That comes out
with the setting — and the advice is obsolete twice over, since the premise was
probably never true in the first place.

---

## Loose ends closed

### The theme setting's on-disk shape (the review's F1)

A notation error ran through most of the session: the setting was written as
`theme = "tokyo-night"` / `theme.light` — which is the **theme file's** flat
format — while being located in `prefs.json` throughout. The actual JSON shape
was never decided, and the decided semantics make it non-obvious: the value is
polymorphic (a string when constant, a pair when adaptive), mutual exclusion
means one form must clear the other, and `prefs` is a deliberate leaf with
tolerant decode.

**Options:** a polymorphic `theme` field (string *or* object — reads nicely, but
tolerant-decoding a two-typed field means probing both, and "what does a corrupt
value degrade to" turns murky in the store meant to be dumbest); an always-object
form (`{"constant": …}` / `{"light": …, "dark": …}` — explicit, verbose for the
common case, invents a wrapper key); or three flat string keys.

**Decision: three flat string keys** — `"theme"`, `"theme_light"`,
`"theme_dark"`, alongside the existing `"session_list_mode"`.

- Matches what `prefs.json` already is (a flat map of scalars), so **tolerant
  decode stays exactly as dumb as today**: missing, empty or unrecognised falls
  to the shipped default *per field*, with no type probing.
- **Mutual exclusion is enforced on write** — committing a constant clears both
  slots; assigning a slot clears the constant.
- If a hand-edit leaves both present, **`theme` wins**, as a documented
  deterministic rule.
- The "only two states" model stays a *rule* rather than being encoded in a
  type: non-empty `theme` ⇒ constant, otherwise the pair, with unset slots
  holding shipped defaults.

**`prefs.json` is the hand-editable home for the theme setting.** Portal has no
separate user config file, and prefs already holds `appearance` today with the
README instructing users to set it by hand — the theme setting inherits exactly
that: machine-written by the panel, hand-editable by anyone who prefers.

### Which built-in is "the default built-in" (the review's F2 / F15)

The phrase was used throughout without ever being resolved: it is what a rejected
theme falls back to, what the no-shadowing rule exists to protect (*"if a user
file can shadow the default built-in, the fallback itself can be broken"*), what
a missing persisted theme resolves to, and what `portal doctor` reports against.
Only the shipped *setting* (the adaptive pair) had been decided, which is a
different thing.

It is non-trivial because the fallback was described in the singular while the
setting has two slots.

**Decision: the fallback is per-slot and mode-matched.** A broken or unloadable
`dark` resolves to `tokyo-night`; a broken `light` resolves to
`tokyo-night-day`; a broken *constant* resolves to `tokyo-night`.

This introduces **no new mechanism** — it is the already-decided "an unset slot
holds the shipped default" rule applied to a slot that is *set but unloadable*
rather than unset. One rule covers both cases.

It also disposes of the review's F15: because the shipped adaptive default and
the fallback default are then **the same values**, the earlier argument that
shipping the pair "degrades to shipping a constant dark" stays true rather than
quietly resting on two different notions of "default".

Rejected: a single fixed fallback regardless of mode. Simpler to state, worse in
practice — a light-terminal user with a typo in their light slot would be thrown
to a dark theme, a bigger surprise than falling to the light default.

Lee: *"that is what I've been assuming"* — locked explicitly rather than left
implied.

### Persisted theme missing from disk

Ratified explicitly rather than left implied: a persisted theme name that no
longer resolves takes **the same path as a rejected theme** — fall back to the
default built-in, keep the persisted name (never overwrite), and surface via the
slide-over, `portal doctor`, and the `theme` log component. One not-loadable
path serves deletion, renaming, a typo in the name, and a missing token alike.

### What a theme file may contain (the review's F8)

Answered by the accumulated decisions, but worth stating: a Portal theme file
contains **exactly the 19 token keys** (the optional `name` field was dropped —
see the identity amendment). Unknown keys are ignored; there is no behaviour, no
includes, no nesting.

This means Ghostty's documented caveat — *a theme can set any config option, so
don't use untrusted ones* — **does not transfer**. Portal's theme file is a
closed key set of colour values with no capacity to influence anything else, so
ingesting an unreviewed drop-in file carries no configuration-injection surface.

### Terminal colour capability (the review's F13)

Raised as an open question: a floor validated on a truecolor hex says nothing
about the colour actually painted after `lipgloss`/`colorprofile` downsamples on
a 256- or 16-colour terminal, and Helix's `is_16_color()` check refuses truecolor
themes on incapable terminals.

**No action, deliberately.** Spec §2.4 already accepts downsampling as graceful
degradation for MV — "a hue may approximate, but the contrast floor still governs
legibility" — and nothing about user themes changes that. Bundled themes are
floor-checked on their truecolor values exactly as MV is today; drop-ins are
syntactic-only by decision, so there is no floor to invalidate. Helix's check is
real validation on an axis Portal has already chosen not to police.

---

## Capture harness & tests

### The premise correction — committed PNGs were scaffolding, not an asset

The orchestrator analysed this as a **themes × fixtures matrix problem**: 43
committed reference PNGs × 4 built-ins = 172 images on a harness already recorded
as flaky-on-write, with every accepted PR theme adding 43 more. That looked like
a wall.

**Lee: the committed references were never meant to persist.** They existed so he
could watch the redesign come to life during implementation — *"it was never
really designed to be kept … I should have dictated that those weren't persisted
once the feature was implemented."* With no regression obligation, the matrix
obligation disappears entirely and the cost analysis collapses.

(Note this contradicts how `CLAUDE.md` currently describes `testdata/vhs/` — as
committed reference PNGs forming a visual-verification harness — which reads as a
durable asset. Worth correcting when the docs are updated.)

### The constraint that makes `capturetool` load-bearing

Recorded prominently because it explains why this tool exists and must keep
working:

**Lee cannot run Portal from a temporary build to check a visual change.** A
scratch build interferes with the live system — it disturbs the running daemon,
its bootstrap sequence touches real state, and *"even when you try to sandbox it,
there are issues"*. So `capturetool` is not a convenience; it is the **only
viable route** to seeing a visual change before release.

This also explains and endorses the fixtures' deliberate shallowness: *"they do
just enough to visualise what you're meant to be visualising, and then that's
it."* Fixtures are about **look, not behaviour** — they need not be functionally
complete.

### Decisions

- **`capturetool` and `internal/capture` survive and are open for edit.** Whatever
  the tool needs to work with the new system is in scope for this feature — no
  separate redevelopment work unit. Lee: *"whatever you have to do to the
  capturetool to make it work with the new system, that's what we have to do."*
- **Everything the tool previously produced is deleted.** The committed reference
  PNGs go; they could not survive the token rename and the theme split without a
  full recapture in any case, and they are explicitly not wanted as a permanent
  asset.
- **The harness must be repaired for the theme change**: `tui.Build` takes a
  *theme* where it took a `prefs.Appearance` (the exact injection mechanism this
  work removes), and `capturetool` gains a `--theme` flag. Without this the
  harness can only ever render the compiled-in default.
- **New fixtures are added for the slide-over** — the adaptive-pair state, the
  constant-while-previewing state, and the narrow degraded panel — so the panel is
  visible during implementation rather than at release.
- **`internal/capture` must stay alive regardless** of what happens to the
  images: the swap-and-diff completeness guard drives the fixture *renderer*.

### Two mechanisms, two audiences — both stay

The orchestrator initially conflated these, treating the still image as "how the
design reaches Lee". It is not. Corrected:

- **VHS tapes → PNGs are for the *agent*.** During the agentic implementation
  loop the implementer captures a screen, looks at it, and assesses its own work;
  the reviewer does the same. **Without a producible PNG the agent cannot see
  what it built**, and Lee ends up hand-correcting every task — the explicit
  failure mode this tooling exists to prevent.
- **`capturetool --fixture` is for *Lee*.** He loads it in a real terminal at the
  human-in-the-loop gate and judges it as the real thing — Portal's look and
  feel, without running Portal.

**The workflow this serves** (recorded because it constrains the harness):
implement → capture → agent self-assesses → reviewer → converge → *then* the
human gate. Lee is involved only once the implementer and reviewer are both
satisfied.

**VHS is not removed.** Rendering a terminal screen to an image means driving a
real terminal emulator and screenshotting it, which is exactly what VHS is built
for. Direct PNG output from `capturetool` is welcome *if* it proves cheap, but it
optimises a mechanism that already works, and the only forced change here is
theme injection. The **requirement** is that every fixture can produce a PNG;
VHS-vs-direct-writer is a genuine implementation detail, not a deferred decision.

### Retention — draw the line now

- Everything that exists today (PNGs, tapes, fixtures) is deleted.
- From this feature forward, captures are created as work proceeds, **committed
  while they are being collaborated on**, and cleared out after sign-off so they
  do not live in the repository forever.
- Cleaning up is **not this feature's job** and is not done as we go.

### The swap-and-diff guard, specified properly (the review's F12)

**What it is** (jargon that went undefined for a while): render a screen under
theme A, switch to theme B, render again, and scan the second output for any
colour value belonging to theme A. A survivor means some element never got the
new theme — the "assert no stale data survived the invalidation" trick applied to
rendered output rather than a cache. It exists because the cached styles
`bubbles/list` holds cannot reliably be found by reading code.

**The flaw as first specified:** it only works if A and B share **no** values.

- A hex both palettes happen to set identically survives the swap
  *legitimately*, so the test fails permanently for a non-bug.
- Worse and silent: a token with the *same* value in both themes renders
  identically before and after, so the test cannot tell whether that site updated
  — it passes either way and the site is uncovered with no signal.

Using two shipped themes makes both failure modes a matter of time, and a future
PR theme could introduce an overlap unnoticed.

**Decision: construct two synthetic themes inside the test**, all 38 values
deliberately unique — none repeated within a theme or across the pair. No
coincidence is possible, every token site is genuinely covered, and nothing done
to the shipped palettes can break or blind the guard. It also permits a stronger
assertion: not merely "no A value survives" but "every expected B value is
present", catching a site that renders nothing at all rather than merely stale.

**Lane: unit.** It renders only through the offline harness — no tmux server, no
daemon, no built binary — which is where `CLAUDE.md` draws the line.

**The two known offenders stay fixed *and* guarded.** `pagepreview.go`'s
package-init `Token` copy would hold theme A's value straight through a swap;
fixing it does not make the guard redundant, the guard is what stops it
returning.

Lee's framing, accepted: this is **purely a testing concern** with no product
behaviour either way, and owned by the orchestrator rather than arbitrated.

### File ordering is not a contract (the review's F13) — withdrawn

The token-naming decision accepted one ambiguity (the ramp's `text.tertiary` →
`text.muted` join) and mitigated it with *"the ramp ships in ramp order in the
file — ordering is part of the contract"*, borrowed from base16.

**Withdrawn.** Lee: *"why would theme token order matter? They have keys and
values. Order should be irrelevant in all cases."* He is right, and the borrowing
was invalid: base16's tokens are named `base00`–`base07` and its spec requires
them to run dark-to-light, so **position is the meaning**. Portal's names carry
their own meaning, so order carries nothing — and the chosen flat `key = value`
format parses unordered anyway, making the "contract" unenforceable and
undetectable.

**Where the ramp's ordering actually lives: `docs/theming.md`**, which documents
each of the 19 roles and its relative weight. That is the seed's own deliverable
and exists regardless. A theme author learns the vocabulary there — they were
never going to infer a six-step ramp from six adjectives in isolation.

### Verification — four resolutions (the review's F4, F5, F14, F15)

**Contrast checking needs a light/dark distinction that "no variant concept"
removed (F4).** Three light surface tints cannot be checked numerically
(light-tint-on-light-canvas is numeric-insufficient — hence
`TestLightSurfaceTintsPinned`), so the carve-out must apply to light themes only.
**Resolution: it is the *test* that needs to know, not the product.** A test table
is allowed to know things the runtime does not — the vocabulary stays
variant-free, and the table names which built-ins are light. Separately,
`contrast_test.go` currently measures against **two hardcoded canvases**; under
split each theme carries its own `canvas` token, so the test resolves its
reference background **from the theme** rather than from a constant.

**The swap-and-diff guard's coverage claim was hand-wavy (F5).** "Every expected B
value is present" cannot hold per fixture — no single screen renders all 19 roles
— so it is a **union across fixtures**, which was never stated. And the union is
complete only if every token appears on *some* fixture; the risks are the
transient states (`bg.attention` / `text.on-attention`, `accent.mode`,
`state.destructive`, `text.on-selection`). **Resolution: "every token is exercised
by at least one fixture" becomes an assertion of the guard itself.** A token with
no fixture fails the test and someone adds a fixture, rather than the guard being
silently blind at precisely the sites it exists to protect.

**`capturetool --theme` may point at a real theme file (F14).** The import guard's
invariant is that `internal/capture` never *resolves* config — no XDG lookup, no
prefs read. **An explicit path from a flag is an input, not config discovery**, so
accepting one preserves the invariant. This matters disproportionately: it is the
only visual-verification route for someone authoring a drop-in, given Portal
cannot be run from a temporary build.

**`docs/theming.md` gets a guard (F15).** It is now the sole record of the ramp's
weight ordering and the 19 roles' meanings, with nothing keeping it honest — and
this session found spec §8.1's "2-tone border" claim stale against the
implementation purely by chance. Same drift class, same subsystem. **Resolution: a
test parses the doc's token table and compares the name set against
`Theme.All()`** — cheap, and matching the codebase's existing guard idiom.

### Remaining verification & mechanics (the review's F6, F7, F8, F11, F12, F13)

**Retention deletes artifacts, not fixtures (F7).** *"Everything that exists today
(PNGs, tapes, fixtures) is deleted"* contradicted the guard, which drives the
fixture renderer and whose coverage assertion needs the fixture set to exist.
Clarified: the deletion covers **committed PNGs and the tapes that produce them**.
The Go fixture *definitions* in `internal/capture` and the harness itself are
**permanent**. "Cleared out after sign-off" likewise means the images, not the
fixtures.

**Floor-check enrolment is automatic (F6).** Bundled means *valid and good* and a
PR is intake into that tier, but nothing said how a new theme file enters the
floor checks. Decision: **the floor test auto-enumerates the embedded set**, so a
new file is checked by default, plus a light/dark table carrying an assertion that
**every embedded theme appears in it** — a forgotten entry fails the suite rather
than silently shipping a Portal-endorsed theme nobody checked (or measuring a
light theme against a dark reference). `TestLightSurfaceTintsPinned` becomes
per-light-theme, its pins established at a visual gate when one is added.

**Reason vocabulary extended to seven (F8).** Three labels did not cover the
reject classes other decisions created. The set: `missing tokens`, `bad colour`,
`bad syntax` (duplicate key, quoted value, malformed line), `bad name`,
`reserved name`, `unreadable`, `not found`. *Which* line and *which* key stays in
doctor, where there is width.

**Symlinks (F11).** "No symlink chasing" was ambiguous about files. Decision:
symlinked **files are followed** — the standard dotfiles shape, and dotfiles users
are exactly who hand-authors a theme. Symlinked **directories are not**, which is
what the original phrase guarded. The slug derives from the link name as
enumerated.

**The panel's keymap is descriptor-governed (F12).** The panel introduces `Enter`,
`d`, `l` and `Esc` through a bespoke vertical footer outside `keymap.go` — a second
place a key label can go stale, the very drift class guarded elsewhere. Decision:
the panel's keys live in the descriptor as a panel scope, its vertical footer
renders from it, and `keymap_dispatch_guard_test` covers them. **The slot keys are
pinned here as `d` and `l`** — they had only ever been named inside the Paper spike
description, never in the decision that introduced them.

**Blocked-`t` feedback (F13).** Consistency falls out of an existing precedent:
**flash** where the key *is* bound and the user could reasonably expect it to work
(`NO_COLOR` on Sessions/Projects); **silent** where it is not bound at all
(Preview, modals, burst-locked). That is exactly how `s` already behaves —
Sessions-only, and pressing it on Projects does nothing, quietly.

### Guard tests reshape

- **`TestMVTokenCount`** moves 20 → 19, and its meaning shifts from "MV has 20
  tokens" to "the vocabulary is 19".
- **`TestMVDarkVariantsPinned` is deleted.** Once themes are data files whose
  values are their own source of truth, an exact-hex pin in a Go test is a
  change-detector duplicating the file. The contrast floor test is the real guard
  for bundled themes.
- **`TestLightSurfaceTintsPinned` survives** — and this closes the thread opened
  when the erratum comments were dropped (the review's F5). Three light surface
  tints are **not numerically checkable** (light-tint-on-light-canvas is
  numeric-insufficient; they were confirmed by human eyeball at a validation
  gate), so for those the exact-value pin is the only guard and the comment was
  the only record of the judgement behind it. They keep their pin, and the *why*
  moves into the theme file as a comment — which the flat `key = value` format
  supports. **The format decision is what makes deleting the Go-side erratum
  comments safe rather than lossy.**

---

## Process note — research positions are leans, not decisions

Recorded because it changed how the rest of this session ran.

Research landed roughly eleven decision-shaped positions (terminal-vs-OS signal,
overlay vs shrink-to-fit, apply-on-arrow, persist-on-close, the on-open marker
with no revert key, the contract hint on the panel top, attribution in the repo,
validity as presence-plus-syntax, no panel search, the swap-cost split) and
flagged in its own convergence section that these *"should be re-opened and
ratified in the discussion phase rather than treated as settled by research"*.

Mid-session the question arose whether the discussion was needlessly
re-deriving settled ground. The agreed position, in Lee's words: *"What's in the
research is research. Anything that is decision-shaped still needs to be
ratified, but it does give us a lean … we should be ratifying and discussing
everything, even if it appears to be a decision at the research level."*

So every research position is treated as a **lean with reasoning attached** — it
shortens the discussion but does not replace it, and it can be overturned. Two
in particular have *changed inputs* since research reasoned about them, because
the split decision landed after: the mixed-mode selector list under
apply-on-arrow (research reasoned about arrow-preview under paired, where
arrowing could never flip the canvas), and the fallback-default choice.

---

### Discovery — lazy, not startup-scanned

#### Context

Surfaced by the background review: auto-discovery turns one config read into an
**N-file scan-parse-validate sweep**, on a cold path that is explicitly
latency-engineered — the concurrent-bootstrap flip exists for that path, and this
very feature counts a 50ms first-paint wait as a cost worth removing. An
unbudgeted per-launch sweep would take back exactly what the detection decision
just won.

#### Options Considered

- **Scan at startup** — simple, whole list always ready. Pays the sweep on every
  launch including the overwhelming majority where nobody opens the selector, and
  `portal open <target>` execs straight through with no TUI at all.
- **Lazy** — load the *selected* theme by name at startup (one file read, no
  enumeration); enumerate the directory only when the slide-over opens, where a
  few milliseconds is invisible against a keypress.
- **Watch with `fsnotify`** — k9s's approach on its skins directory, with a
  listener notifying UI components. Machinery for a problem Portal doesn't have:
  you cannot edit a theme file while looking at Portal.

#### Decision

**Lazy.** The cold path costs one file read **per nominated theme** — one for a
constant, two for an adaptive pair (see the construction-timing amendment below) —
regardless of how many themes exist — which also means the drop-in route can never degrade startup no
matter how many files a user accumulates.

Details settled with it:

- **Directory resolution** follows Portal's existing per-file chain shape:
  dedicated env var → `XDG_CONFIG_HOME/portal/themes/` → `~/.config/portal/themes/`.
  Note this is a *directory*, where `configFilePath` resolves *files* — a small
  mechanical difference for the spec to pin.
- **Enumeration is top-level only** — files matching the theme extension in the
  directory itself; no subdirectory recursion, no symlink chasing.
- **Extension:** `.theme` (recommended, low stakes) — the slug is the filename
  minus the extension, so *some* extension is needed for slug derivation.

*(The one item previously listed as still open here — what renders when a
persisted theme name no longer exists on disk — is ratified under "Loose ends
closed" below.)*

---

## Theme model — split, not paired

### Context

Today a theme is `{20 tokens} × {light, dark}`: `Token{Name, Light, Dark}` with
`Token.ColorFor(mode)` picking the variant, and `theme.Mode` threaded as a
parameter through essentially every render helper in `internal/tui`
(`headerStyle(tok, mode, colourless)` and ~20 files of the same shape) whose only
job is to reach `ColorFor`. The alternative is that a theme is **one palette**
that *is* light or dark, so MV becomes two entries rather than one.

This is the branch that determines what a theme file even contains — 20 values
or 40 — so it had to settle before the format.

### Options Considered

**Paired** (status quo)
- Pros: zero migration, zero call-site churn; theme *identity* survives a
  light/dark flip (you pick "Tokyo Night" and stay on it whichever mode is
  active); the selector is one list where arrowing never changes the canvas
  mode, so live preview is a pure colour change.
- Cons: an author must supply 40 values and clear contrast against *two*
  canvases; dark-only famous palettes (Dracula, Nord) have no light half, so
  "what renders in the hole?" becomes a real rule; `mode` keeps travelling
  through the render layer.

**Split**
- Pros: `Token` collapses to `{Name, Value}`, `ColorFor` disappears, and `mode`
  stops being threaded through ~20 files — a substantial simplification of the
  render layer. 20 values against one canvas. The "missing variant" problem
  *ceases to exist* rather than being handled. Single-palette is the
  overwhelmingly dominant ecosystem shape (~20 tools surveyed).
- Cons: theme identity no longer survives a light/dark flip — "follow the
  terminal" becomes jumping between two *different* themes, which only works if
  the user nominated a pair. The selector list gets longer and mixed-mode, so
  arrowing in a dark terminal will land on light themes and flip the whole
  screen white. It is also a substantial mechanical change to make.

### Journey

Research's central reframe was that **splitting does not remove the pairing, it
relocates it** — under auto-detection something must still know which palette to
use, expressed as a naming convention, two settings, or in-file metadata. That
initially made split look like a wash.

What dissolved that was the observation that **detection and pairing are
independent axes**, and all four combinations ship somewhere. The cell the
earlier framing never considered — auto-detection *with* single-palette themes,
where detection picks between two **named themes** rather than two variants — is
Helix's design and the best-articulated version found anywhere. So wanting
detection does not commit Portal to paired.

Two further corrections mattered:

- **The pairing MV implies isn't real.** Six of MV's light hexes needed
  *individual* correction and three light surface tints were eyeball-pinned at a
  validation gate — by the person who designed the palette. MV's light and dark
  are two independently-tuned palettes that happen to share token names; the
  struct claims a derivation relationship that does not exist.
- **Charm's direction is easy to misread.** Lipgloss v2 moved `AdaptiveColor`
  into `compat`, but the recommended replacement
  (`lightDark := lipgloss.LightDark(hasDarkBG)`) *keeps paired values* and makes
  detection explicit. Charm de-recommended implicit detection, not paired
  colours — so it is not evidence for split.

The decisive argument was the **authoring burden under the PR route just
decided**: 20 values against one canvas versus 40 against two is the difference
between a contributor porting a palette in an evening and not bothering — and
the dark-only palettes have no light half to supply at all.

### Decision

**Split.** A theme is one palette of 19 values and is itself light or dark. MV
splits into two built-ins carrying the existing values.

Consequences:

- `Token` becomes `{Name, Value}`; `Token.ColorFor` and `theme.Mode` threading
  are removed from the render layer.
- Two questions research listed as *dissolved* stay dissolved, because they were
  conditional on exactly this outcome: *"must a user theme supply both
  variants?"* (no such thing under split) and *"how do the theme name and the
  `appearance` pref compose in the selector?"* (no `appearance` pref survives
  split — the override becomes the *shape* of the theme setting, not a mode
  enum).
- The appearance-axis question is therefore **not a standalone decision** — it
  falls out of this one. What remains genuinely open is whether Portal detects
  at all, and what the adaptive two-theme form looks like if it does.
- New mechanic split needs regardless: **how does Portal know a given theme's
  light/dark identity?** Either derive it from the theme's own canvas luminance
  (the canvas is itself a token — Ghostty's theme browser does exactly this) or
  declare it in the file (tinted8 makes `variant: dark|light` required). Owned
  by *light-dark-detection* / *theme-file-format-and-discovery*.
- The mixed-mode selector list is a live-preview experience question for
  *slide-over-panel-design*, not a blocker here.

Confidence: **high**. Both parties reached it independently, and the mechanical
cost is bounded (research verified the render layer resolves tokens per-frame,
so the change is mostly signature removal rather than behaviour change).

---

## Theme validity — full replacement, no merge

### Context

Surfaced by the background review as a live contradiction in this document: the
audience decision inherited research's validity rule ("all 20 tokens present +
syntactically well-formed") while the file-format section listed "full
replacement or merge over a base" as still open, four paragraphs apart. Those
cannot both hold — a merge model makes partial files legitimate by definition,
which negates "all 20 present".

Merge-over-a-base is also the clear modern direction in the ecosystem (gitui
migrated to it deliberately; atuin chains via `parent`, Helix via `inherits`,
yazi merges user `theme.toml` over the flavor), and research noted that
merge-over-default and selectable-base are the *same* feature rather than
competing ones — so this was a real option, not a straw man.

### Options Considered

**Full replacement** — every theme names all 19 tokens.
- Pros: one rule, one failure mode, self-contained files. Preserves the validity
  rule exactly as inherited. No base-resolution semantics to define.
- Cons: "Tokyo Night but with a red cursor" means copying 20 lines to change one.

**Merge over a base** — partial files declaring `base = "…"`.
- Pros: cheap tweaks; matches the ecosystem's direction.
- Cons: needs base-resolution rules (which base — always MV? the selected theme?
  the same-mode built-in?), and drags in a **Portal-specific hazard**: the canvas
  is *itself a token*, so a partial theme supplying a new canvas while inheriting
  `text.primary` from a base produces an inherited foreground measured against a
  background it was never tuned for. Merge can silently compose two individually
  fine themes into an illegible one.

### Decision

**Full replacement. Every theme must declare all 19 tokens.**

The deciding factor is that the go:embed decision already solved the problem
merge exists to solve: because a built-in *is* a file, "copy a built-in and edit
it" is a first-class workflow, and at 19 tokens the copy is trivial. Lee: *"it's
such a small number of tokens that it's really not difficult to create a variant
by just copy and pasting the whole theme and editing."*

Merge was also never discussed as a want — it arrived as an inherited research
option, not a requirement. YAGNI applies; it stays available as a future
addition because full-replacement files remain valid under any later merge
model (a file that declares everything simply inherits nothing).

The validity rule inherited from research therefore stands, now ratified rather
than assumed: **a theme is listed only if all 19 tokens are present AND every
value is syntactically well-formed.** Explicitly not checked: whether the
colours are good, readable, mutually distinguishable, or clear any contrast
floor.

### Vocabulary evolution — reject missing, ignore unknown

#### Context

Raised by the background review as the direct consequence of full replacement:
under "all 19 present", **adding a 20th token is a breaking change for every
user theme simultaneously** — and it arrives from ordinary future UI work, not
from a deliberate naming pass. `TestMVTokenCount` already pins the count at
exactly 20, so vocabulary size is an enforced invariant. Research found no
application-scale precedent for versioning a token vocabulary (the only
mechanisms surveyed were ecosystem-scale: base16 compatibility branches,
tinted8's required `scheme.supports.styling-spec` field).

Two independent levers, mapping to the two directions the vocabulary can move:

- **Unknown key** → ignore or reject. Tolerating unknown keys makes *removing* a
  token survivable (old files keep working).
- **Missing key** → reject or fall back. Tolerating missing keys makes *adding*
  one survivable — but is a back door into the inheritance just ruled out.

#### Options Considered

**Shape A — degrade per-token.** Missing token falls back to a baked-in base
default; the theme still loads and stays selectable; a permanent banner names
what fell back.
- Pros: degrades gracefully in exactly the case that triggers this — when the
  missing token is *brand new*, the surface it paints is brand new too, so the
  foreign colour is confined to something no existing theme ever coloured. Much
  less destructive than a general merge.
- Cons: needs a **new partial-load path** (load, detect incomplete, patch
  specific tokens, carry "degraded" as a state). And the fallback source is not
  trivial under split — a light theme missing `text.primary` cannot borrow the
  dark built-in's `#C0CAF5` (illegible on a light canvas), so "base defaults"
  must mean *the same-mode built-in*, which is merge-with-a-base under another
  name, canvas hazard intact.

**Shape B — degrade whole-theme.** Missing token means the theme is invalid: it
is not selectable, Portal falls back to the default built-in, and a message
names the missing tokens.
- Pros: **reuses machinery Portal needs regardless.** "Persisted theme isn't
  loadable" already has to exist — a user deletes a theme file, renames it, or
  typos the name in `prefs.json`. B routes the new-token case into that same
  path rather than inventing a second one.
- Cons: throws away 20 correct values because of one absent one; on an upgrade
  that adds a token, a user's theme visibly vanishes and Portal reverts.

#### Decision

**Ignore unknown keys; reject missing keys — Shape B.**

The deciding factor was that B's simplicity is real rather than apparent: the
not-loadable path is required anyway, so B adds no new state, while A adds a
partial-load path plus a same-mode-default resolution rule that recreates the
merge semantics and the canvas hazard.

Surfacing, and a deliberate departure from Lee's opening instinct for a
permanent main-UI banner:

- **Not a permanent notice-band entry.** Portal's notice band is a single-slot
  arbiter with six contenders already (filter line → burst progress → transient
  flash → multi-select banner → unsupported banner → no-tags signpost); a
  seventh permanent contender is a real cost for a rare event. Under B the
  symptom is already loud — Portal is visibly the default theme instead of the
  user's — so the message is *explanation*, not alarm.
- **In the slide-over**, consistent with the rejection-surfacing route already
  favoured, naming the exact missing tokens.
- **Plus a `portal doctor` line.** Doctor is Portal's established config-health
  surface and — unlike anything in the TUI — it works on the
  `portal open <target>` exec path, where the picker never renders and no banner
  would ever be seen. Carried to *non-tui-surfaces-and-docs*.

**Corollary (stated here, not separately debated — flag for spec):** falling
back must **not** overwrite the persisted theme name in `prefs.json`. Portal
keeps the user's choice and renders the default; fixing the theme file restores
it on the next launch without the user re-selecting. Overwriting would make the
failure destructive rather than transient.

**Scope note:** this may be near-hypothetical. Portal's own token rule (spec
§2.8) is that a new surface reuses an existing role and a new token is promoted
only where the value genuinely differs — the vocabulary is designed not to grow.

**Open, pushed downstream:** *which* built-in is the fallback default. Research's
read is dark (MV is dark-first by construction, `theme.Mode`'s zero value is Dark
on purpose, and the dark hexes are the pinned authoritative source). Owned by
*built-in-theme-set*.

---

## Summary

### Key Insights

1. **Detection and pairing are independent axes**, not one package — the session
   inherited them fused from earlier framing, and separating them is what let the
   theme model settle without first settling detection.
2. **One path beats two.** The audience decision, built-ins-as-files, whole-theme
   rejection reusing the not-loadable path, and slots-always-holding-defaults all
   resolved by preferring a single mechanism used by everyone over a privileged
   internal path plus a public one.
3. **Research positions are leans, not decisions** — the process note that
   visibly changed how the session ran, and produced several reversals.
4. **A completeness claim is only as good as the set it was measured against.**
   The Nord port was twice found incomplete (16 of 19 tokens, then half the
   contrast rule set); the swap-and-diff guard's coverage rested on an unstated
   union; the build-time fallback guarantee validated files but not the slugs
   resolving into them. Each was plausible enough to pass unexamined.

### Decisions

**Model & format.** A theme is one palette of 19 values (split, not paired), a
full replacement with no merge, in a flat `key = value` file with `#`-at-line-start
comments, bare `#RRGGBB` values, duplicate keys rejected. Built-ins are the same
files, embedded via `go:embed`. Identity is the filename slug (`[a-z0-9-]`), with
no display-label field and no shadowing of built-in slugs.

**Validity.** All 19 tokens present and syntactically well-formed; unknown keys
ignored, a missing key rejects the whole theme. Bundled themes must additionally
clear the contrast floors; drop-ins need only be valid.

**Detection.** Ships, follows the **terminal background** via OSC 11 (not the OS
scheme via mode 2031), expressed as `"theme"` / `"theme_light"` / `"theme_dark"` in
`prefs.json` — constant or adaptive, mutually exclusive, with unset slots holding
shipped defaults and a per-slot mode-matched fallback. The adaptive pair ships as
the default. No `appearance` pref, no one-shot seed, no variant concept anywhere.

**Built-ins.** Three: Tokyo Night Dark, Tokyo Night Light, Nord — the last with two
corrected values (`state.destructive` `#DD8188`, `state.positive` `#A7C492`) and
three invented ones (`text.muted`, `text.subtle`, `bg.attention`). A further light
theme follows up as separate work, and is a design task rather than a file drop.

**Vocabulary.** 19 tokens (the two border tokens consolidated to one), renamed from
hue and use-site names to weight-and-meaning names. `docs/theming.md` is the source
of truth for the public contract.

**Slide-over.** `t` on Sessions and Projects, key-exclusive, nesting over
multi-select. Arrow previews, `Enter` commits a constant, `d`/`l` commit slots,
`Esc` closes and resolves from persisted state. Everything re-themes including the
panel. Lists the union of files found and whatever prefs names, invalid rows shown
unselectable with a reason. Blocked under `NO_COLOR`.

**Plumbing & verification.** The model holds the active `Theme` and threads it where
`mode` is threaded today. Completeness is guarded behaviourally by a swap-and-diff
fixture test over two synthetic palettes. `capturetool` gains `--theme` and required
direct PNG output.

**Surfaces.** `portal theme export <slug>` (bootstrap-exempt), a `portal doctor`
advisory line, a new `theme` log component, `docs/theming.md`, and a footer keymap
revision promoting `t` and `m` to core while dropping `↑↓ navigate`.

### Spec amendments this feature carries

Three, named so the specification phase picks up all of them:

1. **§12.2 keymap revision** — the footer changes above.
2. **The `portal doctor` contract** — two classes of line, only Portal-health
   checks driving the exit code.
3. **The log-component vocabulary** — a new `theme` component with its own attr
   keys and event catalogue.

Plus the MV spec's own vocabulary sections (§2.1, §2.9, and §8.1's stale "2-tone
border" claim) for the renames, 20 → 19, the dropped `border.footer`, the removal
of `Token.ColorFor` / `theme.Mode`, and the two-hardcoded-canvas framing.

### Open Threads

All twelve Discussion Map subtopics are `decided` and all five review rounds are
fully drained. Two items are deliberately carried forward rather than left
unresolved:

- **MV's own erratum values may carry a chroma flaw** (described as "darkened,
  hue-preserved"). The check is owned by this feature's implementation, before MV's
  values are frozen into theme files — and if it finds anything, shipped colours
  change and "the existing MV values move across clean" stops holding exactly.
- **`text.subtle` has no visual gate yet** — it renders group `··· N` counts and
  pending loading steps, neither of which appears on any captured Nord frame. It
  needs a gate at implementation, on a grouped Nord capture.

Deferred by decision, not omission: transparency (a transparent theme needs no new
detection mechanism, so deferring stays cheap), panel search/filtering, per-session
tags, and the second light theme.

### Current State

Everything above is decided. The document has been consolidated so each subject
reads correctly where it first appears; where a later decision reversed an earlier
one, the reversal is marked in place rather than left to a downstream amendment.

## Triage

(none)
