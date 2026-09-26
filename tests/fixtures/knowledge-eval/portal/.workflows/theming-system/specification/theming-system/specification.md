# Specification: Theming System

## Specification

## 1. Overview & Scope

### 1.1 Purpose

Portal's TUI colour layer is already tokenised: `internal/tui/theme` declares a closed set of named semantic role tokens, every renderer references a token rather than a raw hex, and `theme.MV` is the single built-in palette compiled into the binary. Layout is fixed; only colour is parameterised.

This feature changes **where token values come from** and adds **a surface to switch them**:

1. **Token values load from theme files, not Go code.** A theme is a flat `key = value` file. Built-ins are the same files, embedded via `go:embed` and parsed by the same loader as a user's.
2. **Portal ships three built-in themes** — Tokyo Night Dark, Tokyo Night Light, Nord — so it launches with genuine options rather than a single palette.
3. **An in-app theme selector** — a non-blanking full-height slide-over on the right edge, opened with `t`, where arrowing re-themes the app live behind it.
4. **The token vocabulary is renamed and consolidated** — 20 → 19 tokens, hue names and use-site names replaced by weight-and-meaning names — before those names become the public contract a theme author writes against.

### 1.2 The shape of the change

- **A theme is one palette**, not a light/dark pair. `Token` collapses from `{Name, Light, Dark}` to `{Name, Value}`; `Token.ColorFor` and `theme.Mode` are removed, and the `mode` parameter stops travelling through the render layer.
- **The model holds the active `Theme`** and threads it where `mode` is threaded today. No package-level mutable state.
- **Light/dark is expressed by the shape of the theme setting**, not by anything inside a theme. `prefs.appearance` is removed and replaced by `theme` / `theme_light` / `theme_dark`.
- **Detection ships**, and follows the **terminal background** via OSC 11 — not the OS colour scheme.
- **The exec path (`portal open <target>`) does zero theme work** — no scan, no file read, no parse. It constructs no TUI.

### 1.3 Audience and contribution routes

Portal is realistically a single-user tool. Two contribution routes exist regardless:

1. **PR route** — anyone may open a pull request adding a theme file; if accepted it ships embedded as a built-in.
2. **Drop-in route** — a theme file placed in the user's themes directory is auto-discovered with no registration step. If valid it appears in the selector alongside the built-ins.

This is the ecosystem's standard two-tier shape (library directory + selection setting) without committing to ecosystem-scale governance. It sets the two quality tiers (§6.4) and makes the token names a public contract worth settling now: renaming a token is a mechanical repo-wide change for built-ins, but it *breaks* files in a user's themes directory.

### 1.4 Deferred by decision

Not omissions — each was considered and deliberately excluded from this feature:

- **Transparent themes** (a distinguished value meaning "use the terminal default"). The file format leaves the door open; following the terminal background rather than the OS scheme keeps adding it purely additive later.
- **Panel search / filtering** of the theme list.
- **A second light theme** beyond Tokyo Night Light — follow-up work, and a design task rather than a file drop (§7.5).
- **Merge over a base** (partial files declaring a parent). Full-replacement files remain valid under any later merge model, so this stays available.
- **A `--theme` flag** and **`portal theme list`** — the panel lists themes and doctor validates them.
- **A one-shot detection seed** for a virgin install — the shipped adaptive default already covers the case.
- **Per-theme licence lines, "(adapted)" naming conventions, and any PR contribution ceremony.** Attribution is a source and a link in the docs, nothing further.
- **`fsnotify` directory watching** — the panel re-reads the directory on every open instead.
- **A general settings panel** that would also swallow the `s` grouping-mode cycle. Two mechanisms for two prefs is an accepted mild inconsistency.
- **A runtime last-resort hardcoded palette** beneath the fallback — replaced by a build-time guarantee (§7.6).
- **A panel key that unsets a theme back to the shipped default** (§9.9).
- **A theme "variant" (light/dark) concept** anywhere in the product — neither declared in a file nor derived at load (§4.7).

## 2. Token vocabulary — the 19 roles

### 2.1 The vocabulary is 19 tokens

The closed vocabulary goes from 20 tokens to **19**. Every renderer references a token; no raw hex survives at a call site (the existing glob-based colour-literal guard over `internal/tui` continues to enforce this — see §13.6, where its exemption goes away).

### 2.2 The border tokens consolidate to one

`border.separator` and `border.footer` are **one role**, not two:

- `renderJoinedPanel` already takes a single border token — the 2-tone footer leg was dropped during the Modern Vivid implementation, making the MV spec's §8.1 "2-tone border (`border.separator` + `border.footer`)" claim stale.
- `border.separator` serves the title rule, every modal panel frame (destructive-confirm, edit, help, rename), and edit-modal chips. `border.footer` has exactly **one** production consumer: the footer rule.
- The two carry an identical light hex (`#C9CDDB`), differing only in dark (`#292E42` vs `#20232E`) — a shade nothing ever renders side by side.

**`border.footer` is dropped.** The footer rule renders with the same token as the title rule.

**Accepted visual change:** in dark themes the footer rule becomes marginally more prominent (`#292E42` rather than `#20232E`). Verified through the capture harness.

### 2.3 Naming principle — meaning and weight, never hue or place

Five naming kinds are in play. Three are covered by the table below — two of them failures — and two more, **weight** and **pairing**, are set out beneath it:

| Kind | Example | Verdict |
|---|---|---|
| A **place** | `border.footer` | Wrong — goes stale as other surfaces reuse the token. |
| A **hue** | `accent.violet` | Wrong — lies in every port. A Gruvbox author writes `accent.violet = #d79921` (Gruvbox yellow) and the key actively misdescribes its own value. |
| A **meaning** | `state.destructive` | Right — stays true regardless of palette or where it is drawn. |

This does **not** make everything weight-based — and the reason is that **use-site naming is the ecosystem norm**, not an aberration: Helix names essentially its whole UI half that way. So "a place is wrong" is a judgement about *Portal's* vocabulary, where a token is deliberately reused across surfaces, rather than a verdict on how everyone else does it.

Within that bound, **a fourth kind is right for six of the nineteen: a *weight* name.** The text ramp and the border take one because their role genuinely is "how prominent" — an intrinsic property that stays true in any palette, which is what distinguishes it from a place. The accents keep **meaning** names, because a theme author needs to know what a colour signifies in order to choose one.

**A fifth kind is deliberately kept: a *pairing* name.** `text.on-selection` and `text.on-attention` name **another token** rather than a place, a hue, a meaning or a weight — and that is correct here, because their role genuinely *is* relational: each exists only to be legible on a specific tint, and §13.5 floors it as a pairing. A theme author choosing a value for `text.on-attention` needs to know what it sits on, which is exactly what the name says. **It is also a recognised convention rather than a Portal invention** — Crush's `onPrimary` names the same shape — which matters for the one kind that departs from this section's own stated principle.

**Its cost is stated because it is real and one-directional:** renaming `bg.attention` forces renaming `text.on-attention` in lockstep (§2.4 row 19 records the coupling as a fact), and under §4.6 each rename fails every drop-in using the old key. These two are the only place in the 19 where one rename is necessarily two breaking changes.

### 2.4 The rename table

All 19 tokens, with the Go field name each maps to:

| # | Current token | New token | Go field | Why |
|---|---|---|---|---|
| 1 | `text.primary` | `text.primary` | `TextPrimary` | unchanged — top of ramp, already intrinsic |
| 2 | `text.strong` | `text.secondary` | `TextSecondary` | ordinal makes ramp position explicit |
| 3 | `text.muted-bright` | `text.tertiary` | `TextTertiary` | current name is self-contradictory |
| 4 | `text.detail` | `text.muted` | `TextMuted` | `detail` describes content, not weight |
| 5 | `text.dim` | `text.subtle` | `TextSubtle` | ladder consistency |
| 6 | `text.faint` | `text.faint` | `TextFaint` | unchanged — decorative floor |
| 7 | `text.on-selection` | `text.on-selection` | `TextOnSelection` | unchanged — contrast pairing |
| 8 | `accent.violet` | `accent.primary` | `AccentPrimary` | hue → role (primary accent) |
| 9 | `accent.blue` | `accent.key` | `AccentKey` | hue → role (key-hint) |
| 10 | `accent.cyan` | `accent.mode` | `AccentMode` | hue → role (signals a distinct mode) |
| 11 | `accent.orange` | `accent.attention` | `AccentAttention` | hue → role; one warm token covers filter query, edit-mode, warning flash |
| 12 | `state.green` | `state.positive` | `StatePositive` | hue → meaning (live / attached / success) |
| 13 | `state.red` | `state.destructive` | `StateDestructive` | hue → meaning |
| 14 | `canvas` | `canvas` | `Canvas` | unchanged — already intrinsic |
| 15 | `bg.selection` | `bg.selection` | `BgSelection` | unchanged — names a state, not a place |
| 16 | `bg.warning` | `bg.attention` | `BgAttention` | pairs with `accent.attention` |
| 17 | `bg.track` | `bg.subtle` | `BgSubtle` | use-site → intrinsic weight (a low neutral fill) |
| 18 | `border.separator` | `border` | `Border` | sole border token after consolidation |
| 19 | `text.on-warning` | `text.on-attention` | `TextOnAttention` | lockstep with `bg.attention` |

### 2.5 Role meanings (the public contract)

These meanings are the substance of `docs/theming.md` (§12.4), which is the source of truth for the contract.

Use-sites here are illustrative of each role, not an inventory. **The theme panel's own surface-by-surface assignments live in §9.1** and are not repeated here — one table per view, so they cannot disagree.

**Text ramp — bright to faint, in weight order:**

| Token | Role |
|---|---|
| `text.primary` | Names, wordmark, active labels, modal titles, chip text |
| `text.secondary` | Selected-row meta, help actions, banner/signpost |
| `text.tertiary` | Done-tick labels, selected-row path |
| `text.muted` | Paths, counts, footer labels, subtitles, group headings |
| `text.subtle` | De-emphasised but still readable — group `··· N` counts, pending loading steps |
| `text.faint` | Decorative only — inactive dots, `+ add`, mode indicator, hints. **Never carries content a user must read**; §13.5 floors it below the UI threshold precisely so it cannot |
| `text.on-selection` | Name on the selected row (pairs against `bg.selection`) |

**Accents and states:**

| Token | Role |
|---|---|
| `accent.primary` | Cursor, selector bar, active dot, `?` key, focused field label, mode bar, loading bar |
| `accent.key` | Footer / modal key-hint glyphs |
| `accent.mode` | Signals a distinct mode — Sessions header, Preview chrome, active tick |
| `accent.attention` | Filter query and `/`, edit-mode, warning `⚠` |
| `state.positive` | `●` attached, Sessions count, Projects label, `✓` done, success flash |
| `state.destructive` | Kill / delete emphasis, `▲` |

**Surfaces:**

| Token | Role |
|---|---|
| `canvas` | The owned mode-matched canvas, painted on every cell |
| `bg.selection` | Selected-row tint |
| `bg.attention` | Warning-flash band |
| `bg.subtle` | Low neutral fill — loading-bar empty track |
| `border` | Title rule, footer rule, modal panel frames, edit-modal chips |
| `text.on-attention` | Warning-flash message (pairs against `bg.attention`) |

### 2.6 Accepted ambiguities

Four spots were flagged as genuinely arguable and resolved to the values above:

1. **The ramp's middle join.** `text.tertiary` → `text.muted` mixes an ordinal vocabulary with a qualitative one, so ordering at that join rests on convention rather than the names. Fully positional names (`text.1`…`text.6`) would remove the ambiguity but strip all meaning from ~20 files of call sites — rejected. The ramp's weight ordering is documented in `docs/theming.md` (§12.4), which is where a theme author learns the vocabulary.
2. **`accent.key`** could read as "important" rather than "keyboard key". Accepted over `accent.keyhint` / `accent.hint`.
3. **`bg.subtle`** reuses the word from `text.subtle` in a different namespace. Accepted over `bg.inactive`, which generalises less well.
4. **The `text.on-*` pairing names** couple to other tokens rather than describing themselves. Accepted as a deliberate fifth naming kind — see §2.3 for why the coupling is right for these two roles and what it costs.

### 2.7 File ordering is not a contract

Token order in a theme file carries no meaning and is not enforced. The names carry their own meaning (unlike base16, where `base00`–`base07` must run dark-to-light because position *is* the meaning), and the flat `key = value` format parses unordered — so any ordering "contract" would be both unenforceable and undetectable. The ramp's weight ordering lives in `docs/theming.md`.

## 3. Theme model — split, not paired

### 3.1 A theme is one palette

Today a theme is `{20 tokens} × {light, dark}`: `Token{Name, Light, Dark}` with `Token.ColorFor(mode)` picking the variant, and `theme.Mode` threaded as a parameter through essentially every render helper in `internal/tui` (`headerStyle(tok, mode, colourless)` and ~20 files of the same shape) whose only job is to reach `ColorFor`.

**A theme becomes one palette of 19 values, and is itself light or dark.** MV splits into two built-ins carrying the existing values.

Decisive reasons:

- **Authoring burden under the contribution routes.** 19 values against one canvas versus 38 against two is the difference between a contributor porting a palette in an evening and not bothering — and dark-only famous palettes (Dracula, Nord) have no light half to supply at all.
- **The pairing MV implies isn't real.** Six of MV's light hexes needed *individual* correction and four light surface tints were eyeball-pinned at a validation gate. MV's light and dark are two independently-tuned palettes that happen to share token names; the struct claims a derivation relationship that does not exist.
- **Detection and pairing are independent axes.** Auto-detection with single-palette themes — where detection picks between two *named themes* rather than two variants — is a shipping design (Helix's). Wanting detection does not commit Portal to paired.
- Single-palette is the overwhelmingly dominant ecosystem shape.

**Lipgloss v2's direction is neutral on this decision, not supporting evidence.** Lipgloss v2 moved `AdaptiveColor` into `compat`, which reads at a glance as Charm deprecating paired colours — i.e. as independent support for split. It is not: the recommended replacement, `lipgloss.LightDark(hasDarkBG)`, **keeps paired values** and merely makes the detection explicit. What Charm de-recommended is *implicit detection*, not pairing, so **its direction is neutral on this decision.**

This is a standing fact about a live dependency rather than a discarded option — both APIs are in the tree Portal builds against, and an implementer working through §3.2's collapse of `Token` or §8.8's surviving detect-or-timeout gate will meet them and reasonably ask why Portal hand-rolls a light/dark decision the library has an API for. The answer is that Portal's gate selects between two *named themes*, which `LightDark` does not model.

### 3.2 Go-side data shape

- `Token` becomes `{Name, Value string}`.
- `Token.ColorFor` is **removed**, replaced by a no-argument **`Token.Color()`** returning a `color.Color` via `lipgloss.Color(t.Value)`. An accessor rather than an inline conversion at each site: it keeps the ~182 call sites (§3.4) reading as they do today, gives §13.4's guard one place to derive a token's rendered form from, and leaves a single seam if the value domain ever widens (§4.1's deferred transparent keyword).
- `theme.Mode` (the `Light`/`Dark` enum) is **removed**, along with its threading through the render layer.
- `Theme` remains a struct of 19 named `Token` fields with a stable-order `All()` accessor, but is no longer a package-level `var` holding one built-in — it is the parse result of a theme file (§4). It is an ordinary struct, constructible in a test without going through the loader (which is what the swap-and-diff guard's synthetic themes need, §13.4).
- **`All()`'s stable order is the §2.4 table order, 1 through 19.** It was previously asserted without being defined; the numbering is the definition.
- **The token layer moves to a new leaf package, `internal/theme`**, taking the loader with it. Today's `internal/tui/theme` is a pure data package under the TUI, which no longer fits: the loader does file I/O and binds the `theme` log component (§12.3), and its consumers span two layers — TUI construction, the panel, `portal doctor` and `portal theme export`. Leaving it under `internal/tui` would make `cmd/doctor.go` and the export verb import a TUI subpackage to read a config file.

  One package holds the vocabulary, the parser, the validator, the §6.2 ladder, by-name resolution, enumeration and the embedded set. It binds the `theme` log component — but it is not the only package that emits under it (§8.9); CLAUDE.md's rule is bind once *per package*, which `spawn` and `bootstrap` already span several files under.
- **`cmd/config.go` owns themes-directory path resolution**, via a `themesDirPath` alongside `prefsFilePath` — it already owns every other config path, and §5.5's chain is deliberately the same shape. **The loader takes the directory as an injected value and never resolves it**, which is what keeps the embedded set reachable with no path at all: `internal/capture` uses only the built-in lookup, so §7.1's "`go:embed` is not config discovery" and §13.3's import guard both stay satisfiable. The panel receives the directory through the `ThemeEnumerator` seam (§13.3), wired at construction.
- **`Theme` carries no identity field.** The slug is held alongside the palette by whatever loaded it — the model for the active theme, the enumeration row for a listed one. This is what lets `capturetool --theme <path>` (§13.3) work at all: a theme loaded from an explicit path has no slug, and a struct with a mandatory-but-empty identity field would be lying. Consumers that need both (the `theme: loaded` log line, the panel's `●` placement) already have the slug in hand, because they are the ones that resolved it.
- `theme.MV` as an exported package-level value **ceases to exist**. Its values move into `tokyo-night.theme` and `tokyo-night-day.theme` (§7.3).

### 3.3 Consequences that follow from split

- **The "missing variant" problem ceases to exist** rather than being handled. There is no hole for a dark-only palette to leave.
- **No `appearance` pref survives.** The light/dark override becomes the *shape* of the theme setting (§8), not a mode enum.
- **The selector list is mixed-mode.** Arrowing in a dark terminal can land on a light theme and flip the whole canvas. This is accepted behaviour, not a defect (§9.2).
- **Contrast checking loses the product-side light/dark distinction** it needs for the four eyeball-pinned light surface tints (§13.5). Resolved test-side: a test table is allowed to know things the runtime does not.

### 3.4 Plumbing — the model holds the active theme

`theme.MV` is currently a package-level global read directly at ~182 call sites. Making the active theme switchable is a straight substitution rather than a new mechanism, because **split removes the `mode` parameter** from every one of those sites — so all 182 are being edited regardless, and a parameter slot is freed at exactly the same moment.

**The model holds the active `Theme` and passes it where `mode` is passed today.** No package-level mutable state (`theme.Active` var + setter), no new parameter.

Rejected: mutable package state. Its entire advantage was avoiding churn Portal is now paying anyway, and it would put order-dependent mutable state on the render path. Secondary benefit that matters in this codebase specifically: a test can construct a model with any theme instead of mutating a global and hoping nothing else observed it — and the suite already forbids `t.Parallel()` because the `cmd` package injects mocks via package-level mutable state.

## 4. Theme file format

### 4.1 Flat `key = value` with `#` comments

A theme file is a flat map of 19 `key = value` pairs with `#` comments. No JSON, no TOML, no third-party parser.

```
# Nord — https://www.nordtheme.com/
# state.destructive and state.positive are corrected for Portal's contrast floors.

canvas = #2E3440
text.primary = #ECEFF4
…
```

Rationale:

- Portal already parses this shape (`aliases`), so it is not a new idiom, and it needs **zero new dependencies** — every config today is stdlib `encoding/json` plus one flat `key=value` file.
- **JSON cannot carry comments**, and a theme is the one config file that genuinely wants them: ported palettes need attribution, and the eyeball-pinned light tints need a note recording the judgement behind them. Attribution being repo-side rather than in-UI makes a file header its natural home.
- TOML would add a third-party parser to a codebase that has deliberately avoided one for config, and buys nesting Portal does not need.
- The dividing line already implicit in Portal's own config: *nesting needed → JSON*; *flat human-authored map → flat file*. A theme is squarely the second.

Accepted cost: a small hand-rolled parser, and a second non-JSON config format to document.

**Forward note (not a requirement):** the deferred transparent-theme idea would need a distinguished value meaning "use the terminal default". The route left open is a **distinguished keyword** (`transparent`, `none`) admitted by widening §4.3's value domain — a loader change, purely additive, which is what §1.4 claims.

The route explicitly **closed** is btop's precedent of an *empty* value: §4.2 pins an empty value as `bad colour`, deliberately. A keyword is also self-describing in a file where every other value is a hex, which an empty right-hand side is not.

### 4.2 Lexical rules

`#` is both the comment marker and the hex prefix, and **every value in a theme file starts with `#`** — so the collision must be resolved explicitly. The forcing case is `text.primary = #ECEFF4 # tuned for the lighter canvas`: a colour plus a trailing note, or one invalid value?

| Rule | Detail |
|---|---|
| **Comments** | `#` starts a comment **only at the beginning of a line**, after optional leading whitespace. There are no trailing comments, so the ambiguity never arises — a `#` after `=` is always part of the colour. |
| **Values are bare** | Never quoted. A quoted value is **rejected** with a message saying so. |
| **Duplicate keys** | **Rejected**, not resolved. Silently taking one of two conflicting values is exactly the quiet wrongness the validity rule exists to prevent, and "all 19 present" would otherwise have to define what a repeat counts as. |
| **Whitespace** | **Each line is trimmed at both ends first**, so leading indentation before a key is fine — the same tolerance the comment rule already grants `#`. Then trimmed around `=`. Blank lines ignored. |
| **Keys** | Lowercase by definition (per the vocabulary charset), matched **case-sensitively**. |
| **Encoding** | CRLF tolerated; a BOM is stripped. |
| **Malformed lines** | A line that is neither blank, a comment, nor a well-formed `key = value` pair rejects the file (`bad syntax`). |

**Branch-by-branch, because each one is a user-visible reason label and a test case in the loader test (§13.6):**

| Input | Reason | Why |
|---|---|---|
| `text.primary =` (empty value) | `bad colour` | The line *is* a well-formed pair; the value simply is not `#RRGGBB`. |
| `= #FFFFFF` (no key) | `bad syntax` | Not a pair. |
| `text.primary` (no `=`) | `bad syntax` | Not a pair. |
| A duplicated key — **known or unknown**, **same value or different** | `bad syntax` | The duplicate check is lexical and runs before any key is classified or compared. Making it conditional on the key being known, or on the values differing, adds branches to buy nothing. |
| `Text.Primary = …` | ignored as unknown → file fails `missing tokens` | Keys match case-sensitively (above). Doctor names the missing token, which is what makes it findable (§6.2). |
| `#FFF` / `#FFFFFFFF` / `#GGGGGG` | `bad colour` | §4.3 admits `#RRGGBB` only. |
| **Interior** whitespace in a value (`#FF FFFF`) | `bad colour` | Not a valid hex. Trailing whitespace after the value is trimmed and is **not** an error — it is whitespace around the pair, not inside the value. |
| A value beginning with `"` or `'` | `bad syntax` | **Any leading quote is "quoted"**, matched or not — `"#FFFFFF"`, `'#FFFFFF'` and `"#FFFFFF` alike. Defining it by a *matched outer pair* would send the unmatched case down the ladder to `bad colour` at rung 5, telling the user their colour is wrong when their quoting is. The rule is one character, and it is the first character. |
| A key containing whitespace or `=` (`text primary = …`) | `bad syntax` | **A well-formed key is non-empty and contains no whitespace and no `=`.** Without this the line is a well-formed pair with an unknown key, which is *ignored*, and the file then fails as `missing tokens` — a reason that points at the wrong thing for what is plainly a typo in a key that is otherwise right. |
| An empty file, or one containing only comments | `missing tokens` | It parsed; it declares nothing. |
| A BOM anywhere but the first bytes of the file | `bad syntax` | The BOM strip applies at file start only. |
| `text.primary = #ECEFF4 = x` (more than one `=`) | `bad colour` | **Split on the first `=`.** Everything after it is the value verbatim, so a stray `=` lands in the value and fails hex validation. This also falls out of the comment rule: the format never re-interprets anything right of the first separator. |

### 4.3 Value domain — hex only, `#RRGGBB`

**Values are hex only, in `#RRGGBB` form.** No ANSI indices, no named colours, no `#RGB` shorthand (six digits cost nothing and remove a parse branch).

Portal owns its own validator regardless, because `lipgloss.Color` **never returns an error** and its accepted domain is wider and stranger than a theme format wants: `"212"` is a valid ANSI-256 index, `"-5"` is silently abs'd to `5`, `"16777215"` is reinterpreted as packed RGB (white), and every failure is the silent `noColor` sentinel. Owning the validator is what turns all of that into one honest message.

Two reasons for excluding ANSI indices, the second decisive:

- The MV spec's §2.4 is an explicit decision that Portal **imposes its own exact hues via truecolor and does not inherit the terminal's 16 ANSI colours** — a recognisable identity needs consistent hues across machines. Admitting ANSI indices lets a theme opt back into the palette Portal deliberately declined.
- **An ANSI index has no fixed RGB.** The validator must parse to RGB anyway, and that same parse is what any contrast check needs. A token valued `212` cannot be measured against anything — admitting them would permanently foreclose checking a theme numerically, including Portal's own built-ins.

Hex case (upper or lower) is not constrained on input, and **the parser canonicalises to uppercase**. Two hex-string comparison sites this feature introduces or re-points depend on it: §11.4's retained startup canvas hex against the exit-time value, and §11.3's background diffing. A theme file written `#c0caf5` must not fail to match one written `#C0CAF5`. (§13.4's guard is unaffected — it compares *rendered* SGR sequences, not hex.) (`portal theme export` is unaffected — it emits file bytes, §12.1.)

### 4.4 What a theme file may contain

A Portal theme file contains **exactly the 19 token keys and nothing else**. Unknown keys are ignored. There is no `name` field, no behaviour, no includes, no nesting.

**Security consequence.** Ghostty's documented caveat — *a theme can set any config option, so don't use untrusted ones* — **does not transfer**. Portal's theme file is a closed key set of colour values with no capacity to influence anything else, so ingesting an unreviewed drop-in file carries no configuration-injection surface.

### 4.5 Full replacement, no merge

**Every theme must declare all 19 tokens.** There is no merge-over-a-base, no `inherits`/`parent`/`base` key, no partial files.

- The `go:embed` decision already solves the problem merge exists to solve: because a built-in *is* a file, "copy a built-in and edit it" is a first-class workflow (§12.1 makes it reachable), and at 19 tokens the copy is trivial.
- Merge drags in a **Portal-specific hazard**: the canvas is *itself a token*, so a partial theme supplying a new canvas while inheriting `text.primary` from a base produces an inherited foreground measured against a background it was never tuned for. Merge can silently compose two individually fine themes into an illegible one.
- Merge was never a requirement — it arrived as an inherited option. It stays available as a future addition, because full-replacement files remain valid under any later merge model (a file that declares everything simply inherits nothing).

### 4.6 Vocabulary evolution — ignore unknown, reject missing

The two directions the vocabulary can move are governed by two independent levers:

- **Unknown key → ignored.** This makes *removing* a token survivable: old files keep working.
- **Missing key → the whole theme is rejected.** It is not selectable, Portal falls back per §8.5, and a message names the missing tokens.

Rejected: per-token degradation (missing token falls back to a baked-in base default, theme still loads as "degraded"). It needs a new partial-load path and a fallback source that is not trivial under split — a light theme missing `text.primary` cannot borrow the dark built-in's value, so "base defaults" would have to mean *the same-mode built-in*, which is merge-with-a-base under another name with the canvas hazard intact.

Whole-theme rejection **reuses machinery Portal needs regardless**: "persisted theme isn't loadable" already has to exist for a deleted file, a renamed file, or a typo in `prefs.json`. Adding a 20th token in future routes into that same path rather than inventing a second one.

**Scope note:** this is near-hypothetical. Portal's own token rule (MV spec §2.8) is that a new surface reuses an existing role and a new token is promoted only where the value genuinely differs — the vocabulary is designed not to grow.

### 4.7 No variant concept

**Portal has no notion of a theme being "light" or "dark".** It is neither declared in the file nor derived from canvas luminance.

The mechanic has no consumer:

- Under the adaptive two-slot form, **the slot classifies the theme** — the light slot means "use this when the terminal is light". Portal never inspects the palette to know that.
- Warning that a dark theme sits in the light slot is a *perceptual* judgement, which validation explicitly never makes (§6.1).
- Grouping or filtering the selector list by variant is the deferred panel-search feature. Ordering same-mode themes first was proposed as a mitigation for the mixed-mode flash and **rejected** (§9.2), which removes the last candidate consumer.

The asymmetry is what makes not-deciding safe rather than merely convenient: *declaring* would lock a key into the public contract now, whereas *deriving* costs nothing and needs no format change — so if a selector filter ever ships, the value can be computed that day.

**The one exception is test-side, not product-side:** the contrast test table names which built-ins are light, because the four light surface tints are not numerically checkable (§13.5). A test is allowed to know things the runtime does not.

## 5. Identity, discovery & enumeration

### 5.1 The filename is the identity

**The filename minus its extension is the slug**, and the slug is the durable identity Portal persists in `prefs.json`, writes in config, and displays in the selector. There is no in-file `name` field and no separate display label.

- Zero duplication: file and content cannot disagree.
- Identity is structurally unique by virtue of being a filename in a directory.
- Renaming a theme is a file move — an operation users already understand.
- The contract is a *filename*, so a user renaming their own theme is a deliberate file operation with an obvious consequence, and Portal renaming a built-in is the same kind of breaking change as renaming a token: visible, deliberate, and rare.

An optional display-label field was considered and **rejected**. Two files with distinct slugs could both carry `name = "Nord"`, so labels could collide even though identity could not, and alphabetical ordering would become ambiguous (by slug or by label — they differ the moment a label is set). The cost is display prettiness (`tokyo-night-day` rather than "Tokyo Night Day"), judged not worth a second identifier-shaped thing in the file. Every comparable tool lists slugs, and the constrained charset reads cleanly.

### 5.2 Slug charset — `[a-z0-9-]`

**A slug must match `^[a-z0-9][a-z0-9-]*$`** — lowercase letters, digits and hyphens, at least one character, not starting with a hyphen. A file whose name does not is **rejected** with reason `bad name` and rendered as an unselectable row (§9.5).

The anchoring closes three edges a bare character class leaves open: the **empty slug** is illegal (so a file named exactly `.theme` is rejected, and the empty string stays unambiguously the *unset* sentinel of §8.1), a **leading hyphen** is illegal (it reads as a flag in every context a slug is typed into), and a **trailing hyphen** is legal but pointless. There is **no length bound** — the slug is an identity, and §9.8's truncation is a display concern that must not silently become a validity rule.

**Reject, never normalise.** Lowercasing `Nord.theme` to `nord` would let it shadow the built-in, breaking the rule §5.4 exists to protect.

This removes the case question outright rather than defining case-insensitive matching, so the reserved-name check stays **exact string equality** — which is what the no-shadowing safety property requires, and what makes `Nord.theme` beside a built-in `nord` safe on a case-insensitive macOS filesystem.

The same charset check applies to a **persisted slug** read from `prefs.json` (§8.6).

### 5.3 Extension — `.theme`

Theme files carry the `.theme` extension. Some extension is needed for slug derivation; `.theme` is the choice.

### 5.4 No shadowing — built-in slugs are reserved

**A user file whose slug collides with a built-in is rejected**, with reason `reserved name`, through the same channel as any other invalid theme.

This exists because of a hard constraint: an invalid theme falls back to a built-in, so **if a user file could shadow the built-in that is the fallback, the fallback itself could be broken.** Drop in `tokyo-night.theme` with a typo'd hex and the thing Portal falls back to is the same broken file. That must be impossible.

Rejected alternatives: user-dir-shadows-built-ins with reserved names (needs a reserved-name special case, a precedence chain to document, and "which `nord` am I looking at?" ambiguity), and built-ins-always-win-silently (you edit a file and nothing happens, with no signal at all).

The workaround is a two-second file rename and is self-documenting: copy `nord` to `nord-lee.theme`. With the PR route open, genuinely *correcting* a built-in has a proper channel rather than needing a local override.

**Accepted consequence:** because built-in rows are deliberately indistinguishable from drop-in rows in the panel (§9.5), the reserved-slug set is not discoverable from the UI — a user learns a slug is reserved by having their file rejected with a message naming the conflict. `portal theme export` (§12.1) and `docs/theming.md` make the set discoverable outside the panel.

### 5.5 Directory resolution

The themes directory resolves through Portal's existing per-file chain shape:

**`PORTAL_THEMES_DIR` → `XDG_CONFIG_HOME/portal/themes/` → `~/.config/portal/themes/`**

The env var is fixed in this specification because it is a user-facing documented contract — `docs/theming.md` (§12.4) has to print it, and every other member of Portal's config chain carries a spec-fixed name for the same reason. The `_DIR` suffix (rather than the `_FILE` of `PORTAL_TERMINALS_FILE` and siblings) marks the mechanical difference: this resolves a *directory* where `configFilePath` resolves *files*. There is no one-shot migration from the old macOS Application Support path (the directory is new; nothing exists there to move).

**Directory states:**

| State | Behaviour |
|---|---|
| **Absent** | The common case. **Silent** — zero drop-ins is not an error. No doctor line, no log entry. Portal never creates or seeds it. |
| **Unreadable**, or a regular file where a directory belongs | A genuine misconfiguration: a **doctor advisory line**, and a **`theme: directory unusable` log entry from the TUI path** — emitted both by the panel's enumeration and by the construction-time by-name read (§8.4) when it hits the same condition, deduplicated per process (§12.3) so the two never double up. Emitting from construction too is what gives a user who never opens the panel a log record at all. Doctor itself emits nothing (§12.3) — the two surfaces report the same condition, each in its own medium. |

**A theme made unreachable by an unusable directory carries the reason `unreadable`**, not `not found`. The distinction is the one §9.4 draws for a persisted slug: `not found` sends the user to check the filename, `unreadable` sends them to check permissions — and permissions is the actual problem. It applies uniformly to the reason attr on `theme: fallback applied` (§12.3), the terse reason on the persisted-slug rows rendered beneath the pinned directory row (§9.5), and doctor's line through §14A.

### 5.6 Enumeration rules

- **Top-level only** — files matching `.theme` in the directory itself. No subdirectory recursion.
- **The extension is matched case-insensitively for *enumeration*, but only the exact lowercase `.theme` is *accepted*.** A file whose extension is any other casing (`Nord.THEME`, `nord.Theme`) is enumerated so it is **visible**, and then **rejected as `bad name`** — the filename is not a valid theme filename.

  Both halves are load-bearing. Enumerating case-insensitively is what stops the file being *invisible*, the "completely in the dark" state §9.4 exists to prevent, and it would be invisible most often on the case-insensitive filesystem where a user is most likely to type it that way. Accepting only the exact extension is what preserves §5.1's structural-uniqueness claim: were `foo.THEME` accepted, it would derive the slug `foo` alongside `foo.theme` on a case-sensitive filesystem — two selectable rows with the same label and a persisted `"theme": "foo"` naming both. Since a non-exact extension never contributes a slug, **a duplicate slug cannot be minted** and no new reason, precedence rule or ordering tie-break is needed. The by-name construction path (§8.4), which resolves a slug to a file without enumerating, gets the same guarantee for free: it looks for `<slug>.theme` and nothing else.

  This does not weaken §5.2's reject-never-normalise rule — it is the same rule applied one level up: the casing is reported, never silently corrected.
- **Symlinked files are followed** — the standard dotfiles shape, and dotfiles users are exactly who hand-authors a theme. The slug derives from the link name as enumerated. A **dangling symlink** enumerates and then fails to read: reason `unreadable`.
- **These rules govern entries *inside* the themes directory. The resolved themes directory itself may be a symlink and is followed** — dotfiles users symlink `~/.config/portal` and its contents as a matter of course, which is the same reason symlinked files are followed. Not following the root would make every drop-in vanish with no row and no doctor line (§5.5 makes an absent directory deliberately silent), which is the "completely in the dark" state §9.4 exists to prevent.
- **Symlinked directories are not followed** as entries. A **real subdirectory** named `x.theme` is **skipped silently** — enumeration matches files, and a directory is not a candidate that failed, it is not a candidate at all. A **symlink whose target is a directory** is treated identically: skipped silently. What the entry resolves to is what decides, not whether a link is involved, so there is one rule rather than two.
- **`unreadable` covers every read failure**, not only permissions — a dangling link, an I/O error, or anything else that stops the bytes arriving.

### 5.7 Discovery is lazy

Auto-discovery must not turn one config read into an N-file scan-parse-validate sweep on a cold path that is explicitly latency-engineered.

- **At construction**, Portal loads **only the nominated themes by name** — one file read for a constant, two for an adaptive pair (§8.4). No enumeration.
- **Enumeration happens only when the slide-over opens**, where a few milliseconds is invisible against the keypress that opened it.

This means the drop-in route can never degrade startup no matter how many files a user accumulates, and the exec path (`portal open <target>`) does no theme work at all.

Rejected: startup scan (pays the sweep on every launch including the overwhelming majority where nobody opens the selector), and `fsnotify` watching (machinery for a problem Portal does not have — it does not need to *watch* the directory, it needs to not *cache* it).

### 5.8 Enumeration re-reads on every open

The directory is enumerated **on every panel open**, not once per process. It is a directory read of a handful of small files behind a keypress; caching buys nothing measurable while breaking the loop the drop-in route exists for — copy a built-in, edit it, see it, without relaunching Portal.

**The enumeration's parse results are retained for the panel's lifetime**, so arrowing previews from values already in hand — no file read per keystroke, which is what keeps the swap the O(1) restyle of §11.1. They are discarded when the panel closes; the next open re-reads.

**The panel's parse supersedes the construction-time parse for the same slug.** After a mid-session edit the panel holds the fresher truth, and that is the entire point of re-reading. Two consequences, both following from the same rule:

- **`Esc` resolves persisted state against the panel's enumeration**, not against what construction loaded. If the user edited their active theme's file and broke it, `Esc` lands on the §8.5 fallback — Portal shows what the config now says, not a stale copy it happens to still hold.
- **The mirror case works for the same reason**: fixing a previously-invalid theme takes effect on the next panel open, without relaunching. That symmetry is what §5.8 exists to buy.

## 6. Validity & rejection

### 6.1 The validity rule

**A theme is valid if and only if all 19 tokens are present AND every value is syntactically well-formed.**

Explicitly **not** checked at load: whether the colours are good, readable, mutually distinguishable, or clear any contrast floor. Validity is syntactic, never perceptual.

Validity is what makes a theme **selectable**. An invalid theme is listed but unselectable (§9.5), and anything nominating it falls back per §8.5.

### 6.2 The reason vocabulary

Seven reject classes. The terse label appears on the panel row; the detail appears in `portal doctor` and the `theme` log component.

| Reason | Cause |
|---|---|
| `missing tokens` | One or more of the 19 keys absent |
| `bad colour` | A value that is not a well-formed `#RRGGBB` hex |
| `bad syntax` | Duplicate key, quoted value, or a malformed line |
| `bad name` | **The name is not usable as a theme identity.** Three causes across two input classes. From a **directory entry**: the slug does not match `^[a-z0-9][a-z0-9-]*$` (§5.2), or the extension is not exactly lowercase `.theme` (§5.6). From a **non-file input** — a persisted slug (§8.6/§9.4) or a CLI argument (§12.1) — the value fails the same charset rule, with no extension involved. One reason class because the user-facing fact is the same in all three, and the panel row has no width to discriminate; doctor and export name which (§14A), and their differing line frames (`⚠ theme file <filename>: …` versus `⚠ theme <slug> …`) are what carry the input class. |
| `reserved name` | Slug collides with a built-in |
| `unreadable` | The file could not be read |
| `not found` | A slug named by `prefs.json` with no corresponding file |

*Which* token is missing, *which* line is malformed, and *which* key carries a bad colour stays in doctor, where there is width to enumerate.

**Reasons are evaluated in a fixed order and the first failure short-circuits**, so a file always has exactly one reason and the panel's single-reason row is never a choice:

1. `bad name` — the **filename** is checked before the file is opened, so a `bad name` file can never also report `unreadable` or anything about its contents. Both causes live here, and both mean the file yields no usable slug — which is what lets the next rung assume one exists.
2. `reserved name` — likewise decided from the slug alone, before any read. Unreachable for a `bad name` file, which has no slug to collide.
3. `unreadable` — the read itself failed.
4. `bad syntax` — lexical failure (§4.2) aborts the parse, so no value-level or presence check runs.
5. `bad colour` — value validation across every **known** key in the file. **Unknown keys' values are not validated**, because §4.6's forward-compatibility lever requires it: if a removed token's stale line could reject a file on its value, "old files keep working" would only hold for values that happen to still be well-formed hex, which is a much weaker guarantee than the one §4.4 and §4.6 state. An unknown key is ignored entirely — key and value both.
6. `missing tokens` — the presence check runs last, on a file that parsed and whose every known value is well-formed.

`not found` is not in this ladder — it applies only to a persisted slug with no file (§9.4), where there is nothing to check.

**Doctor enumerates within the reason, not across reasons** — all missing tokens, or all bad-coloured keys, for the one reason that applies. It does not report a file as both `bad colour` and `missing tokens`.

**A wrong-case key is an unknown key** (§4.2 matches case-sensitively), so `Text.Primary` is ignored and the file fails as `missing tokens`. That reason is technically accurate but can misdirect, so doctor's detail line names the missing tokens — which is what makes the mistake findable.

### 6.3 Where rejection surfaces

The job splits by surface rather than forcing any one of them to do all of it:

| Surface | Carries |
|---|---|
| **The slide-over panel** | Every theme file gets a row; invalid ones render unselectable with the terse reason (§9.5). Sufficient to tell the user their file did not work and it is not their imagination. |
| **`portal doctor`** | The detail — full terminal width, per-file, enumerating exactly which tokens are missing or which key is bad. Advisory only; does not drive the exit code (§12.2). |
| **The `theme` log component** | The passive forensic trail (§12.3). The only record that exists without the user going looking. |

**Falling back must never overwrite the persisted theme name in `prefs.json`.** Portal keeps the user's choice and renders the fallback; fixing the theme file restores it on the next launch without the user re-selecting. Overwriting would make the failure destructive rather than transient.

A **permanent notice-band entry** was considered and rejected. Portal's notice band is a single-slot arbiter with six contenders already; a seventh permanent contender is a real cost for a rare event. Under whole-theme rejection the symptom is already loud — Portal is visibly the fallback theme instead of the user's — so the message is *explanation*, not alarm.

### 6.4 Two quality tiers

**Contrast floors apply to what Portal ships; syntactic validity applies to what users write.**

| Tier | Membership | Requirement |
|---|---|---|
| **Bundled** | Built-in, or an accepted PR — a PR is *intake into this tier* | Must be valid **and good**. Contrast floors, bands and thresholds are checked (§13.5). It carries Portal's name. |
| **Drop-in** | The user's themes directory | Must be **valid only** (§6.1). Whether it looks good is the user's business. |

The bundled tier is what stops the selector filling with Portal-endorsed themes nobody can read. Relaxing a floor for a named port was the one option ruled out, because it would break the guarantee that is the entire point of having tiers.

**Consequence: porting is not free.** A straight palette lift may not clear the floors unmodified — MV's own light variants needed six individual corrections, and the Nord port needs two (§7.4). Each bundled theme is real work, which argues for shipping a small number well rather than a large library.

### 6.5 Terminal colour capability — no action

A floor validated on a truecolor hex says nothing about the colour actually painted after `lipgloss`/`colorprofile` downsamples on a 256- or 16-colour terminal. Some applications (Helix) refuse truecolor themes on incapable terminals.

**Portal does not.** The MV spec's §2.4 already accepts downsampling as graceful degradation — "a hue may approximate, but the contrast floor still governs legibility" — and nothing about user themes changes that. Bundled themes are floor-checked on their truecolor values exactly as MV is today; drop-ins are syntactic-only by decision, so there is no floor to invalidate. This is real validation on an axis Portal has already chosen not to police.

## 7. Built-in theme set

### 7.1 A built-in *is* a theme file

Built-in themes are `.theme` files embedded via `go:embed` and parsed by the **same loader** as a user's drop-in. They are not Go structs.

- One code path, one format, one validity rule. A PR is "add a file". A user copies a built-in, tweaks two values, drops it in `themes/` — which is how people actually make themes.
- The format is dogfooded by every built-in, so a bad format is the maintainer's problem on day one rather than a stranger's on day ninety.
- Prior art: Ghostty and kitty avoid inventing a theme format at all — a theme *is* a config file.

Consequences:

- **Parse failures move from compile-time to load-time**, so built-ins need the build-time guarantee of §7.6.
- **`internal/capture`'s no-real-config import guard is preserved** — `go:embed` is not config discovery, so the embedded set stays reachable from the capture harness without touching the config path.
- **MV's inline erratum comments are deleted, not ported.** `contrast_test.go` already enforces the corrected values numerically, so a comment recording *why* a hex differs from its upstream sibling is duplicated history — revert a hex and the test fails, with or without the comment. The one class of judgement that is *not* numerically recoverable (the four eyeball-pinned light surface tints — §13.5) moves into the theme file as a `#` comment, which the flat format supports (§13.6).

### 7.2 The shipped set — three built-ins

Portal ships **three** built-in themes:

| Slug | Palette |
|---|---|
| `tokyo-night` | Tokyo Night Dark — the existing MV dark values |
| `tokyo-night-day` | Tokyo Night Light — the existing MV light values |
| `nord` | Nord, dark-only as the palette is |

Two routes were rejected: split-only (two themes — satisfies the letter of "not a single built-in" but not the spirit of "genuine options", being one palette in two modes), and a four-theme set including a second light theme.

The deciding argument was **risk, not scope**: the 19-token vocabulary has only ever been exercised by the palette it was designed for, so porting one genuinely external palette is the first real test of whether the roles map cleanly — and that test must happen *before* the names become a public contract. Nord makes the test unusually sharp because its canvas is `#2E3440`, a mid-dark rather than a near-black, so its contrast headroom is materially tighter than MV's.

The counterweight is that everything after the first external theme is cheap by construction: `go:embed` makes adding a theme literally adding a file, and the PR route exists to receive exactly that.

**Accepted cost:** the light side ships with a single option until the follow-up (§7.5). The adaptive default still works out of the box either way, since it is Tokyo Night on both slots.

### 7.3 Tokyo Night Dark and Light — the existing MV values

The existing MV values move across unchanged, subject to the erratum re-derivation check of §7.7.

**`tokyo-night.theme`** (from MV's `Dark` variants):

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `canvas` | `#0b0c14` | | `accent.primary` | `#BB9AF7` |
| `text.primary` | `#C0CAF5` | | `accent.key` | `#7AA2F7` |
| `text.secondary` | `#A9B1D6` | | `accent.mode` | `#7DCFFF` |
| `text.tertiary` | `#828BB8` | | `accent.attention` | `#FF9E64` |
| `text.muted` | `#737AA2` | | `state.positive` | `#9ECE6A` |
| `text.subtle` | `#535C86` | | `state.destructive` | `#F7768E` |
| `text.faint` | `#3B4261` | | `bg.selection` | `#28243a` |
| `text.on-selection` | `#FFFFFF` | | `bg.attention` | `#241B10` |
| `border` | `#292E42` | | `bg.subtle` | `#26283A` |
| `text.on-attention` | `#E8C9A0` | | | |

**`tokyo-night-day.theme`** (from MV's `Light` variants):

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `canvas` | `#e1e2e7` | | `accent.primary` | `#8A3FD1` |
| `text.primary` | `#2E3C64` | | `accent.key` | `#2D5CCA` |
| `text.secondary` | `#3F4760` | | `accent.mode` | `#0D6C87` |
| `text.tertiary` | `#4C5478` | | `accent.attention` | `#9A5200` |
| `text.muted` | `#586093` | | `state.positive` | `#3B5E18` |
| `text.subtle` | `#767DA2` | | `state.destructive` | `#BD2545` |
| `text.faint` | `#AEB2C6` | | `bg.selection` | `#D0C6F0` |
| `text.on-selection` | `#1A1B2E` | | `bg.attention` | `#E8D6A8` |
| `border` | `#C9CDDB` | | `bg.subtle` | `#D2D4DE` |
| `text.on-attention` | `#7A4B12` | | | |

Note `border` takes the former `border.separator` value in both; `border.footer` is dropped (§2.2).

### 7.4 The Nord port

Nord is a 16-slot ANSI palette (Polar Night `nord0–3`, Snow Storm `nord4–6`, Frost `nord7–10`, Aurora `nord11–15`). Portal's 19-token vocabulary is meaningfully wider than 16 slots **at the dark end**, so the port takes **13 values directly**, **corrects two**, **invents three**, and takes **one functional maximum** (`text.on-selection` = `#FFFFFF`, which is a contrast choice rather than a palette claim). 13 + 2 + 3 + 1 = 19.

**The measured input**, every Nord colour against Nord's own canvas `nord0 #2E3440`. This is the port's *source* material, kept alongside its output because a leg that fails on a value taken **directly** from the palette has no Oklab correction available — the value is Nord's own — and the remedy is instead "is another slot a better fit?", the move this port already made once (nord8 over nord7):

| | ratio | | ratio |
|---|---|---|---|
| nord1 `#3B4252` | 1.24 | nord9 `#81A1C1` | 4.64 |
| nord2 `#434C5E` | 1.45 | nord10 `#5E81AC` | 3.10 |
| nord3 `#4C566A` | 1.69 | nord11 `#BF616A` | 3.05 |
| nord4 `#D8DEE9` | 9.25 | nord12 `#D08770` | 4.39 |
| nord5 `#E5E9F0` | 10.26 | nord13 `#EBCB8B` | 8.00 |
| nord6 `#ECEFF4` | 10.84 | nord14 `#A3BE8C` | 6.13 |
| nord7 `#8FBCBB` | 5.99 | nord15 `#B48EAD` | 4.41 |
| nord8 `#88C0D0` | 6.24 | | |

Two declined slots are worth reading off it, because they are the near-misses that make a substitution question non-trivial: **nord12 at 4.39** sits just under the 4.50 foreground floor — a plausible candidate that fails — and **nord10 at 3.10** clears the 3.00 UI floor while failing 4.50, so under §13.5 it is legal for `accent.primary` and illegal for every other accent. This table is also what supports the barrelled-greys claim below as a statement about the whole palette rather than the six values quoted there.

**`nord.theme`:**

| Token | Value | Source | Ratio vs canvas |
|---|---|---|---|
| `canvas` | `#2E3440` | nord0 | — |
| `text.primary` | `#ECEFF4` | nord6 | 10.84 |
| `text.secondary` | `#E5E9F0` | nord5 | 10.26 |
| `text.tertiary` | `#D8DEE9` | nord4 | 9.25 |
| `text.muted` | `#939EB2` | **invented** | 4.62 |
| `text.subtle` | `#73819B` | **invented** | 3.18 |
| `text.faint` | `#4C566A` | nord3 | 1.69 |
| `text.on-selection` | `#FFFFFF` | functional maximum | 8.63 on `bg.selection` |
| `accent.primary` | `#B48EAD` | nord15 | 4.41 |
| `accent.key` | `#81A1C1` | nord9 | 4.64 (floor 4.50) |
| `accent.mode` | `#88C0D0` | nord8 — chosen over nord7 `#8FBCBB` (5.99) as Nord's own primary UI accent | 6.24 |
| `accent.attention` | `#EBCB8B` | nord13 | 8.00 |
| `state.positive` | `#A7C492` | **corrected** from nord14 `#A3BE8C` | 6.51 canvas / 4.50 selection |
| `state.destructive` | `#DD8188` | **corrected** from nord11 `#BF616A` | 4.50 |
| `bg.selection` | `#434C5E` | nord2 | 1.45 fill |
| `bg.subtle` | `#3B4252` | nord1 | 1.24 fill |
| `bg.attention` | `#3D4046` | **invented** | 1.20 fill |
| `border` | `#4C566A` | nord3 | no numeric floor |
| `text.on-attention` | `#ECEFF4` | nord6 | 9.02 on `bg.attention` |

**Correction 1 — the red.** `state.destructive` carries the 4.5 normal floor; Nord's published red `#BF616A` measures **3.05** against Nord's own canvas. Shipped corrected as `#DD8188` (4.50), **retaining ~94% of Nord's red chroma** — the figure that makes the shipped value checkable against the derivation rule below if it is ever re-derived. The floor holds with no carve-out — this being the *first* external palette, a carve-out granted here would set the precedent for every PR theme after it.

**Correction 2 — the green.** The single `state.positive` token must clear **both** the canvas and the selection tint. Nord's `#A3BE8C` clears canvas at 6.13 but only **4.23** on nord2. Corrected to `#A7C492` (Oklab ΔE 0.018 — essentially imperceptible), clearing selection at 4.50 and canvas at 6.51, with chroma marginally *above* the original. This is precisely the problem MV itself solved by darkening its light green.

**Invention 1 & 2 — the ramp's middle.** Nord's greys are barrelled at the ends: three bright (9.25 / 10.26 / 10.84) and three dark (1.24 / 1.45 / 1.69), with nothing between. Portal needs `text.muted` ≥ 4.5 and `text.subtle` in the 3.0–4.5 band, so both are interpolated on nord3's hue and saturation.

**Invention 3 — the warning band.** `bg.attention` is a *background tint* — neither a neutral from the barrelled dark end nor a foreground accent. Settled at `#3D4046` (~8% nord13-into-canvas blend, fill 1.20), matching MV's own proportion: MV's `bg.warning` measures only **1.15** against its canvas — the tint is a whisper, not a wash. A first arithmetic answer (`#54524F`, a 20% blend at fill 1.60) was rejected at a visual gate as far too heavy and pushed into a warm grey outside Nord's cool family.

**One honest divergence from MV:** MV warms its on-band text (`#E8C9A0`) to match the band. Nord's Snow Storm is entirely cool and has no warm light, so `text.on-attention` uses nord6 — cooler than MV's treatment, but faithful to the palette. A deliberate port choice.

**Structural finding worth carrying forward:** Nord's dark end holds only three values (nord1/2/3) for Portal's **five** dark-end roles (`bg.subtle`, `bg.selection`, `border`, `text.faint`, `bg.attention`). `nord3` therefore serves both `border` and `text.faint`, *and* `bg.attention` is interpolated outright. A palette choosing one value for two roles is legitimate (unlike two tokens that differ pointlessly, which the border consolidation removed) — but **every port should expect to invent at the dark end.**

**Fidelity versus floors — resolved.** The floors win, and the corrected values ship under the palette's own name. No application maps a 16-slot ANSI palette 1:1 onto its own semantic roles; every Nord port in the wild adapts — Ghostty, Zellij and k9s each ship one. The corrections are minimal and perceptually close, judged **visually** (both reds mocked side by side in a Nord kill modal), and `docs/theming.md` records them alongside the attribution.

**Derivation method — corrections versus inventions.** Contrast **corrections** must be computed in a **perceptual space (Oklab), never by moving HSL lightness** — raising lightness at fixed HSL saturation *drops actual chroma* (the first red offered, `#CF888F`, lost ~27% of Nord's red saturation and read washed-out and pink). A correction has a published source value whose chroma must be preserved. An **invented** value has no source to preserve; its constraints are landing in the right band and looking right, which is why `bg.attention` was settled at a visual gate rather than by arithmetic.

**The pairing legs the port was verified against.** The per-token ratios above are only half the rule set — the second correction was found by walking the *pairing* legs. This is the port's verification baseline, to be re-checked if any value moves (§7.7):

| Leg (rule per §13.5) | Nord measured | |
|---|---|---|
| `bg.subtle` fill vs canvas | 1.24 | ✓ |
| `bg.selection` fill vs canvas | 1.45 | ✓ |
| `bg.attention` fill vs canvas | 1.20 | ✓ |
| `state.positive` on `bg.selection` | 4.23 → **4.50** corrected | ✗ → ✓ |
| `text.on-selection` on `bg.selection` | 8.63 | ✓ |
| `text.primary` on `bg.selection` | 7.49 | walked, not required¹ |
| `text.secondary` on `bg.selection` | 7.09 | ✓ |
| `text.tertiary` on `bg.selection` | 6.39 | ✓ |
| `text.on-attention` on `bg.attention` | 9.02 | ✓ |
| `accent.attention` bar vs canvas | 8.00 | ✓ |
| `accent.primary` vs canvas | 4.41 | ✓ |
| `accent.key` vs canvas | 4.64 | ✓ |
| `accent.mode` vs canvas (peek chrome) | 6.24 | ✓ |
| `text.subtle` band | 3.18 | ✓ |
| `text.faint` band | 1.69 | ✓ |
| `state.destructive` vs canvas | 4.50 | ✓ |

**The floors themselves live in §13.5 and are not restated here** — this table records only what Nord measured and whether it passed, so the two can never disagree.

¹ **`text.primary` on `bg.selection` is not a required leg.** It is absent from §13.5's rule set — the selected row's name renders in `text.on-selection`. Walked during the port; the figure is kept as free information, not as a gate.

**A failure on an unwalked leg can force re-deriving an *invented* value — which then needs a fresh visual gate.** The port was twice found incomplete (first covering 16 of 19 tokens, then roughly half the rule set), and each time the completeness claim was plausible enough to pass unexamined. The floor test auto-enumerating the embedded set (§13.5) means a missed leg surfaces at implementation rather than shipping — but if it lands on `text.muted`, `text.subtle` or `bg.attention`, the new value is an *invention*, and this port's own precedent (§7.4, `bg.attention`) is that inventions are settled at a visual gate rather than by arithmetic.

**Outstanding visual gate:** `text.subtle` has no locus on any captured Nord frame — it renders group `··· N` counts and pending loading steps, neither of which appears on the flat Sessions frame. **It needs a visual gate at implementation, on a grouped Nord capture.** (`text.muted` has already been seen — it is the "N window(s)" text on `Sessions — Nord (port)`.)

### 7.5 A further light theme — follow-up work

A second light theme is deferred to separate work, and is **a design task, not a file drop**:

- A **dark** theme is genuinely near-free: floor checks auto-enumerate the embedded set, and no eyeball pins are involved.
- A **light** theme requires `TestLightSurfaceTintsPinned` per-light-theme, whose pins are established by human eyeball at a visual gate through `capturetool` — the only viable route, because Portal cannot be run from a temporary build (§13.1).
- **There is no CI** (tests and lint run locally), so a contributor gets no signal that their theme fails a floor until the maintainer runs the suite.

### 7.6 The build-time guarantee

There is **no runtime fallback to hardcoded values** beneath the built-in fallback. Instead the situation is made impossible at build time.

**A unit test must:**

1. **Parse and validate every embedded built-in** against the full validity rule (§6.1).
2. **Assert that every fallback slug and the shipped default pair resolve within that set.**

Both halves are load-bearing. Validating the files alone proves the *files* are good, but the fallback is hardcoded slug constants (`tokyo-night`, `tokyo-night-day`) resolving *into* that set — rename a built-in file in a later PR, or typo a constant, and every embedded theme still validates while **every fallback path becomes unresolvable.**

With no path pretending to handle it, a binary somehow shipped with a broken default fails **loudly at startup** rather than limping on values nobody chose.

**Mechanism:** the loader returns an ordinary error for an embedded parse failure — it does not panic. The escalation happens where the fallback is *needed*: a fallback that cannot resolve is a fatal error returned up the normal path, so the user sees a one-line message rather than a Go panic trace. `main.go`'s panic-recovering exit and its `process: panic` lifecycle marker remain the backstop for a genuine programming fault, not the designed route. **Validation is not startup-eager** — nothing walks the embedded set at init, because §7.6's test already proves it at build time and re-proving it on every launch buys nothing on a cold path this feature otherwise adds no cost to.

Rejected: a compiled-in last-resort palette equal to Tokyo Night Dark. A build-time guarantee beats a runtime crutch.

### 7.7 MV's erratum values — a re-derivation check

MV's corrected light values are described in-source as *"darkened, hue-preserved"*, which may carry the same chroma flaw as the rejected Nord red — in the opposite direction.

**The values in scope, named here so the check is self-contained** — they are otherwise identifiable only from the inline erratum comments that §7.1 deletes, which is an ordering trap: delete the comments first (the natural order, since they go when the values move into `.theme` files) and the check's input set is gone.

The **six `§2.9 erratum` corrections**, given as original → shipped, under their new token names:

| Token | Original | Shipped |
|---|---|---|
| `text.muted` | `#5A6296` | `#586093` |
| `text.subtle` | `#7C84AA` | `#767DA2` |
| `accent.key` | `#2E5FD0` | `#2D5CCA` |
| `accent.mode` | `#0E7490` | `#0D6C87` |
| `state.positive` | `#4C7A1F` | `#456E1C` → `#3B5E18` (darkened twice) |
| `state.destructive` | `#C32647` | `#BD2545` |

**Plus a seventh, `text.tertiary` (`#515A80` → `#4C5478`)** — not an erratum but a darkening for the `bg.selection` pairing floor, so it carries the same chroma risk and is checked with the other six.

`accent.primary` (`#8A3FD1`) is explicitly **out of scope**: its in-source note records that it cleared its floor unremedied, so it was never darkened.

**Owned by this feature's implementation, before MV's values are frozen into theme files.** Three steps, and the middle one is the point:

1. **Re-derive** each value in Oklab — the minimal-Oklab-distance colour that clears the same floor.
2. **Measure chroma loss** of the *shipped* value against its *original*, the way the Nord red was diagnosed: `#CF888F` lost ~27% of the source's chroma and was rejected on sight; `#DD8188` retains ~94% and shipped. This is the quantity under suspicion — "darkened, hue-preserved" is a claim about chroma — and it is **not** what ΔE answers. ΔE(shipped, re-derivation) says whether the re-derivation landed somewhere else; the two disagree in both directions, since a shipped value can sit within threshold of the re-derivation while both have shed chroma against the original, and a value can exceed the threshold on lightness alone with chroma intact.
3. **Gate** anything that moved materially.

**The chroma figure is recorded for all seven values regardless of outcome**, which is also what closes a gap §7.4 opens: Nord's two corrections carry their chroma figures precisely so they are checkable if ever re-derived, and without this step MV's would be the only corrections in the built-in set without one.

**Its home is a `#` comment beside the value in `tokyo-night-day.theme`** — the same home §7.1 gives the other judgement that is not numerically recoverable, the eyeball pins. It is the only durable option: the theme file is exported byte-faithfully to users (§12.1), it travels with the value it describes, and it survives a re-derivation that supersedes §7.3's tables. A commit message would be gone in a year; `docs/theming.md` documents roles, not derivations.

**Threshold: Oklab ΔE ≥ 0.05 is "moved materially".** The Nord port anchors the scale at the other end (ΔE 0.018, cited as essentially imperceptible), and 0.05 is comfortably above that while still well below a difference anyone would describe as a colour change. Under it, nothing happens.

**Acceptance criteria, so the check has a determinate outcome either way:**

- **Every value under threshold** → the check passes, `§7.3`'s tables stand, nothing moves, and the result is recorded (a passing check is a finding, not a non-event).
- **Any value at or over threshold** → that value is replaced by the re-derivation and gets a **fresh visual gate**. If it is one of the four eyeball-pinned tints (§13.5), `TestLightSurfaceTintsPinned` and `TestLightTintFillsArePerceptible` take the new pin from that gate.
- **If a re-derived value is rejected at its fresh visual gate**, the **shipped value stands**, recorded as "measured, moved, judged worse". The check surfaces a possible flaw; it does not mandate a change — a numerically-better value that looks wrong is exactly the failure the Nord red's first correction demonstrated.
- **If anything moves, §7.3's value tables in this specification are superseded by the theme files** rather than being re-written here. The files are the source of truth for values (§15.3); this spec's tables are the record of what was carried across, and a note pointing at the moved values is the honest form once they diverge.

**Flagged consequence:** if the check finds anything, shipped colours change, `TestLightSurfaceTintsPinned`'s eyeball-established pins move, and "Tokyo Night Dark/Light are just the existing values" (§7.3) stops holding exactly. **The built-in-set decision is conditional on this check.**

## 8. The theme setting — resolution & detection

### 8.1 On-disk shape — three flat string keys in `prefs.json`, plus a migration marker

`prefs.json` gains three theme keys and one migration marker alongside the existing `session_list_mode`:

```json
{
  "session_list_mode": "flat",
  "theme": "",
  "theme_light": "",
  "theme_dark": "",
  "theme_migrated": false
}
```

**`theme_migrated`** is not a theme setting — it is the one-shot gate for the `appearance` translation (§10.3). Its contract:

- **Type: boolean.** Not a version string or timestamp — the translation is a single event with no successor, so there is nothing to version.
- **Tolerant decode:** anything that is not literal `true` — absent, empty, corrupt, unrecognised — decodes to `false`. This keeps decode as dumb as the string keys: the failure direction is "run the translation again", and the translation is idempotent by §10.5, so a corrupt marker costs one redundant write rather than a wrong theme.
- **Written on the first post-upgrade prefs load whenever `prefs.json` already exists**, including when there is nothing to translate (`appearance` is `auto` or present-but-unrecognised). §10.2's "Nothing" refers to the *theme keys* — the marker is still set, so the condition is not re-evaluated forever.
- **Not written when `prefs.json` does not exist.** A fresh install has no `appearance` to translate, so creating the file purely to record a marker would be a new side effect on a path this feature otherwise adds nothing to (§5.5 pointedly refuses to create the themes directory; §12.3 records that the exec path stays free). Re-evaluating on each launch costs an absent-field check on a read that is already happening — free, and the file appears the moment the user changes anything.
- **Empty values are omitted on write** (`omitempty` across the theme keys and the retained `appearance`). The §8.1 example above shows the full schema, not the on-disk shape: a key the user has never set is *absent*, which is exactly the "unset slot holds the shipped default" semantics of §8.3, keeps a hand-editable file clean, and means a downgraded binary reads an absent `appearance` as absent rather than as an empty string.
- **Never participates in mutual exclusion** (§8.2). It is orthogonal to which theme keys are set, and clearing theme keys by hand does not clear it — that is precisely the property §10.3 exists to guarantee.

Rejected: a polymorphic `theme` field (string *or* object — tolerant-decoding a two-typed field means probing both, and "what does a corrupt value degrade to" turns murky in the store meant to be dumbest), and an always-object form (`{"constant": …}` / `{"light": …, "dark": …}` — explicit but verbose for the common case, and invents a wrapper key).

Three flat keys match what `prefs.json` already is — a flat map of scalars — so **tolerant decode stays exactly as dumb as today**: missing, empty or unrecognised falls to the shipped default *per field*, with no type probing.

**`prefs.json` is the hand-editable home for the theme setting.** Portal has no separate user config file, and prefs already holds `appearance` today with the README instructing users to set it by hand. The theme setting inherits exactly that: machine-written by the panel, hand-editable by anyone who prefers.

### 8.2 Two states, not three

A theme setting is either:

- **Constant** — `"theme": "nord"`. Detection is never consulted.
- **Adaptive** — `"theme_light"` / `"theme_dark"`. Detection chooses.

"Nothing set" and "pair nominated" are **the same state**: the shipped default *is* an implicit pair, so the loader needs no unconfigured branch — only a default value per slot.

**Mutual exclusion is enforced on write.** Committing a constant clears both slots; assigning a slot clears the constant. Whichever was set last wins, so "both a constant and a pair are present" cannot arise from Portal's own writes.

**If a hand-edit leaves both present, `theme` wins** — a documented deterministic rule. The "only two states" model stays a *rule* rather than being encoded in a type: non-empty `theme` ⇒ constant, otherwise the pair.

**`theme` winning means the slots are not read at all**, so the panel renders a single bare `●` on the constant's row and no slot badges — §9.5's "the two setting states never coexist on screen" holds because the resolution rule makes the pair invisible, not because the file cannot contain both. The stale slots are left untouched on disk; nothing prunes them.

The one visible consequence: on such a file, `d`/`l` clears the constant and the *other* stale hand-edited slot becomes live in the same keypress. The §9.2 confirm names the constant being cleared, which is the change the user initiated; the stale slot surfacing is then plainly visible in the panel's badges the moment the confirm resolves.

### 8.3 The shipped default is the adaptive pair

Portal ships with the pair already nominated:

```
theme_light = tokyo-night-day
theme_dark  = tokyo-night
```

So a brand-new user gets whichever matches their terminal, automatically.

Reasons over shipping a constant dark default:

- **The 50ms is a timeout, not a price** — terminals that answer do so in single-digit ms — and it applies only to TUI launches, since `portal open <target>` execs without painting.
- **It degrades to the alternative**: no answer resolves to dark, so the adaptive pair is a superset of a constant dark default with a bounded downside.
- **Asymmetric escape.** Pinning is one line and is the *simpler* config (`"theme": "tokyo-night"`), so an annoyed user has an obvious remedy. The alternative's failure has no signal at all — a light-terminal user gets a dark Portal forever and never learns a light theme exists.
- **The ecosystem answers this the same way.** `bat` (`--theme` defaults `auto`), `delta` (`--detect-dark-light` defaults `auto`), Neovim (`background` auto-set by the TUI at startup and re-detected when a UI attaches) and `yazi` all **detect by default**. This is the one external check on a decision that ships a named risk to every install (below), so it is worth having on record.

  **One apparently contrary claim is refuted**, and the same material is easy to re-derive from: *"every surveyed application ships a hardcoded default and starts rendering"* came from a research paragraph research itself superseded. The narrower claim that survives is that nobody **prompts** on first run — which is the precedent for not seeding and not prompting (§8.7), not for declining to detect.

**Risk named:** a terminal that answers OSC 11 inconsistently makes Portal flip between launches. The one-line pin is the remedy.

**Partial pairs do not exist.** The adaptive form always has two slots and the shipped values are their *defaults*, so `"theme_dark": "nord"` yields `{light: tokyo-night-day, dark: nord}` — light is still the shipped default because it was never overridden. There is no incomplete-pair state to validate, explain, or render around, and the shipped default and a partially-overridden pair are **the same mechanism** rather than two.

### 8.4 Construction timing — load every nominated theme

**At construction Portal loads every *nominated* theme — at most two.** The light/dark gate then only **selects** between values already in hand.

This is load-bearing because three other decisions collide otherwise: the model holds the active `Theme` (§3.4), discovery is lazy and does one read by name (§5.7), and a two-slot user's light/dark resolves **after** `Init`, when the OSC 11 reply or the 50ms timeout lands. Since the shipped default *is* the adaptive pair, the common path constructs the model before the slot is known — and both alternatives were bad: defer the read onto the first-paint critical path, or paint dark and flip.

**Cold-path cost:** one file read for a constant, two for a pair. No file read on the critical path, no flip.

**Resolution order on the by-name path: the embedded set first, then the themes directory.** A nominated slug that names a built-in resolves to the built-in and **never reads the themes directory at all**. This is what makes §5.4's no-shadowing guarantee implementable on the path that matters — construction does not enumerate, so there is no collision to *detect* there; the safety property has to come from ordering. And construction is where the fallback resolves, which is the exact thing no-shadowing exists to protect.

**Mid-session slot assignment loads the *other* slot at commit time.** A constant nominates one theme, so converting to adaptive makes a second slot live that construction never loaded. The slot the user just assigned needs no read — §5.8's enumeration already holds its parse, which is what makes arrowing the O(1) restyle of §11.1. The read that is needed is the **opposite** one:

- **An untouched slot holds a shipped default** (§8.3), so it resolves from the embedded set and never touches the themes directory (§8.4's ordering rule) — cheap and infallible.
- **A stale hand-edited slot** (§8.2, where a `theme`-wins file's slots were invisible until the constant cleared) **resolves from the panel's retained enumeration** (§5.8), which already parsed and classified every file in the directory when the panel opened. Only a slug the enumeration has no entry for falls through to the embedded set, and if it is in neither it is unresolvable and takes §8.5's fallback.

**No commit-time directory read.** Issuing one would produce a *third* parse of the same slug — neither construction's nor the panel's — that can disagree with the row the user is looking at, reintroducing exactly the staleness split §5.8 exists to close. The panel's parse is the fresher truth by §5.8's own rule, so the panel row and the applied theme cannot disagree.

Both are keypress-time work, which is already the panel's cost model. **This is the one theme load that happens outside construction**, so it emits `theme: loaded` at commit rather than at construction — the catalogue's cadence column (§12.3) accounts for it.

**The constructor therefore takes the loaded *nomination*, not a single theme.** One value covering both states:

- **Constant** — one loaded `Theme`, active from frame one; the gate is never consulted.
- **Adaptive** — both loaded `Theme`s, light and dark, and **no active member yet**. The gate selects one when the OSC 11 reply or the timeout lands, which is before first paint (§8.8).

**The nomination carries no provisional active member under adaptive**, and nothing needs one: the gate resolves before anything is painted, so there is no frame to render in the interval and no second resolution to reconcile with §8.8's resolve-once rule. §11.4's retained startup canvas hex is captured **when the gate resolves**, which is the same moment the first frame is composed — so it is defined for every frame that exists, and if Portal dies before then nothing was painted and there is nothing to restore.

**The constructor also takes the raw persisted theme keys** — `theme`, `theme_light`, `theme_dark` as held by the loaded prefs value, control-stripped per §9.5. **"As read" means the post-translation in-memory value, not the on-disk bytes**: §10.5 computes the `appearance` translation and uses it in memory immediately, precisely so a launch renders the right theme even when the write is deferred or fails. Handing the panel the disk bytes instead would make a migrated user's badges claim two shipped defaults while a constant is actually painting the screen, and would stop `d`/`l` raising §9.2's confirm — silently doing the thing the confirm exists to prevent, to the one population §10.1 identifies as needing protection. The nomination alone is insufficient for the panel, in three ways it cannot recover:

- **A slug that never loaded is not in the nomination.** §9.4 requires a row for a persisted slug resolving to neither a built-in nor a file, and for a persisted string rejected by the charset check. Neither ever produced a `Theme`.
- **A badge needs the *persisted* slug, not the nomination's**, wherever one is set. Under a fallback these differ by design — "the `●` still marks the persisted slug" (§9.2) while the nomination holds the fallback's palette. (An *unset* slot's badge comes from the shipped default instead — §9.5 gives the full rule.)
- **§14A's confirm renders the persisted constant**, on a path where that constant may be the one that failed to load.

The model holds that nomination, the raw keys, and which member is currently active — "the model holds the active `Theme`" (§3.4) describes what is *threaded to renderers*, which is always exactly one theme.

**The panel uses the construction-time prefs snapshot; it does not re-read `prefs.json` on open.** This is a deliberate asymmetry with §5.8's fresh directory read, and the two are asymmetric because the files are: the themes directory is what the drop-in loop edits by hand between panel opens, which is the loop §5.8 exists to serve, whereas `prefs.json` is what Portal itself writes. Re-reading it would let another instance's commit silently change what this panel shows and marks — the cross-instance sync §8.9 explicitly declines. A user who hand-edits prefs mid-session sees it on the next launch, consistent with every other prefs consumer.

**`portal doctor` reports the keys *in force*** — under §8.2's `theme`-wins rule that is the constant alone when one is set, and both slots otherwise. Reporting an ignored key as unresolvable would send the user to fix something Portal is not reading. `capturetool --theme` (§13.3) passes the constant shape: a pinned single theme, no gate, no wait, which is what makes captures byte-deterministic.

**The retained startup canvas hex (§11.4) is captured from the theme the gate *selected***, not from what the constructor was handed — under adaptive those differ until the gate resolves.

### 8.5 Fallback — per-slot and mode-matched

When a nominated theme is unloadable (invalid file, missing file, bad persisted slug):

| Nominated slot | Falls back to |
|---|---|
| `theme_dark` | `tokyo-night` |
| `theme_light` | `tokyo-night-day` |
| `theme` (constant) | `tokyo-night` |

This introduces **no new mechanism** — it is the already-decided "an unset slot holds the shipped default" rule applied to a slot that is *set but unloadable* rather than unset. One rule covers both cases, and it makes the shipped adaptive default and the fallback default **the same values**.

**§8.3's second reason depends on that coincidence.** "The adaptive pair degrades to a constant dark default" is true *only* because an unresolvable slot lands on the same theme the shipped default nominates — before this fallback was pinned, that argument was resting on two different notions of "default" and the gap went unnoticed. So **changing these values, or adopting the single-fixed-fallback alternative rejected below, silently invalidates §8.3.** 

Rejected: a single fixed fallback regardless of mode. Simpler to state, worse in practice — a light-terminal user with a typo in their light slot would be thrown to a dark theme, a bigger surprise than falling to the light default.

**One not-loadable path serves every cause** — a deleted file, a renamed file, a typo in `prefs.json`, a missing token, a bad colour. All fall back, keep the persisted name (§6.3), and surface through the panel, doctor and the log.

### 8.6 The persisted slug is validated before use

The persisted value comes from a hand-editable file and is used to **locate a file by name** on a path that deliberately does not enumerate — so `../something` would be used as a path component.

**Validate the persisted slug against the same `[a-z0-9-]` charset before use** (§5.2), and treat an invalid one as unresolvable: fallback plus report, identical to any other unresolvable theme.

### 8.7 Light/dark detection

**Detection ships. The signal is the terminal background via OSC 11.** DEC mode 2031 (the OS colour scheme) is deliberately **not** adopted — on semantics, not availability. It is fully plumbed end-to-end in Portal's stack (`x/ansi` mode constants and report parsers, `ultraviolet` decoding DSR `997;1`/`997;2` into typed events, Bubble Tea v2 passing them through to `Update`, a one-line `tea.Raw(ansi.SetModeLightDark)` opt-in) and tmux 3.6+ supports it. It is declined because it answers a different question, not because it is out of reach.

The two answer different questions: `ModeLightDark` reports *the operating system's* colour-scheme preference; OSC 11 reports *what colour the terminal's background is*. They routinely disagree — a terminal pinned dark on a light OS is the canonical case. On terminals that don't support 2031, tmux *synthesises* the answer by guessing from the background colour anyway.

**What detection is for discriminates the signals.** Because Portal owns an opaque canvas and guarantees its contrast floors against that canvas, a mode mismatch is *jarring, never illegible*. Detection's entire payoff is therefore **aesthetic blending with the surrounding terminal** — which wants the terminal's background, OSC 11's question.

Three arguments carried it:

1. **Transition dominance.** Portal's dwell time is seconds — launch, pick, exec into a session, many times a day — so the transition in and out dominates the experience. Matching the terminal reads as "your terminal, with a picker in it". Matching the OS against a pinned terminal flashes light and drops back to dark, twice per use.
2. **A terminal/OS mismatch is usually deliberate, not stale.** A pinned terminal is an explicit choice about the environment Portal lives in. For something that lives inside a terminal, the terminal's background is arguably the *more* relevant preference.
3. **Forward compatibility with transparency** (deferred, not rejected). A transparent theme *must* follow the terminal background, so choosing terminal now makes adding transparency later purely additive.

**Accepted cost: OSC 11 is query-only; 2031 pushes on change.** Portal gets *correct-at-startup*, not *live-following* — a terminal that flips mid-session is not noticed until the next launch. Judged thin: terminal backgrounds rarely change mid-session, and when they do it is usually because the terminal is itself following the OS.

**The "detection is unreliable inside tmux" premise is retired.** It was the main argument for deleting the appearance axis entirely, it appears in the README, and it does not survive testing — OSC 11 works reliably through tmux. The README advice that rests on it comes out with the setting (§12.5).

**A one-shot detection seed is not shipped.** Under this design detection acts only when the user nominated a pair — but since the shipped default *is* a pair, a brand-new user with a light terminal already gets the light theme. There is no unconfigured case left to seed.

### 8.8 What survives and what dies in the appearance gate

Under the two-slot form, the gate is only *partly* removed:

| | |
|---|---|
| **Dies** | The `prefs.Appearance` **enum and its API** — the `auto\|light\|dark` type, its tolerant decode, `LoadAppearance`/`SaveAppearance`, `WithAppearance`. (`SaveAppearance` has no production caller today, so this is mostly read-path removal.) **The on-disk field does not die — see below.** |
| **Dies via split** | `Token.ColorFor`, `theme.Mode` threading, the dual-canvas contrast bookkeeping. |
| **Survives, but conditional** | The detect-or-timeout first-paint gate. A user on a **constant** theme needs no detection, so their first paint is immediate — a real startup win. A user on the **adaptive** form still needs light/dark resolved *before* first paint or Portal paints one theme and flips, so the same race, ~50ms timeout and **dark** no-answer fallback still apply. Dark is the ecosystem's universal no-answer fallback — Helix, Neovim, delta and Glamour v2 all use it, Helix exposing it as an explicit configurable third value that Portal hardcodes. The grounding matters more under split, where the fallback selects a whole named theme rather than a variant. |
| **Survives unchanged** | The OSC 11 *query* itself — `restore.go` needs it to capture the original background for restore-on-exit, independent of detection. The `NO_COLOR` carve-out. The canvas-echo guard, whose comparison re-points from "the mode's canvas" to a retained startup canvas hex (§11.4). |

**The query is issued from `Init` regardless of the setting shape.** That is what makes a mid-session constant → adaptive conversion work without a new query, race or gate (§9.3).

**The gate resolves exactly once. A reply that arrives after the timeout has resolved it does not re-resolve it.** The reply is still *consumed* — `restore.go` needs it for the original-background capture, and §9.3 needs it in hand for a mid-session conversion — but it never flips the active theme.

This matters more under split than it did before. A late flip used to swap one palette's light variant for its dark one; now it swaps to **a different theme entirely** — the other slot's nomination, potentially Nord for Tokyo Night Day — changing the canvas and every accent a second after the user is already reading the picker. Single resolution is also what makes §11.4's "the startup canvas hex captured from the theme the gate selected" a single, unambiguous value, and what keeps a late reply from overwriting an uncommitted preview in an open panel.

**`prefsFile` keeps a raw `appearance string` field, so the on-disk value round-trips.** This is load-bearing, not tidiness: `prefs.json` decodes into a plain Go struct, so **any key not declared as a field is dropped on re-encode** — and §8.9 makes every writer re-encode the whole file. Delete the field and the first `s`-keypress or theme commit after upgrade silently erases the user's `appearance` pin, defeating §10.4's downgrade guarantee at the moment the user is least likely to notice.

The field is a **plain string that is read and preserved, never parsed** — no enum, no tolerant decode, no accessors. §10.5's translation reads it once; nothing else in the new binary looks at it. That is the precise meaning of the "Dies" row above: the *type and its API* go, the *slot in the file* stays.

### 8.9 Concurrent instances and prefs writes

Portal's multi-window burst routinely produces several concurrent processes, so multiple live instances are normal.

- Each instance loads its theme at construction; an instance that changes theme persists it; **other instances are unaffected until relaunch.** There is no file watch.
- This is exactly how `session_list_mode` already behaves — the `s` toggle persists per-instance with no cross-instance sync, via the existing `ModePersister` seam that a theme persister follows.

**The panel's commit write is owned by `cmd`, not by `prefs` or by the TUI** — a theme persister injected at construction through a `WithThemePersister` option, exactly the shape `WithModePersister` already has. The same three constraints that decided §10.5's ownership apply unchanged here: `prefs` is a leaf that must not import `internal/log`, the write needs prefs path resolution, and the `theme` component records its failure. The persister resolves the path, calls `prefs`, and is **the emission site for `theme: commit failed`** (§12.3), which otherwise has none.

**The merge itself lives inside `prefs`, behind field-specific save methods** — `SaveTheme`, `SaveThemeSlot`, `SaveMigrationMarker`, and **`SaveTranslation`** (theme key plus marker in one write, required by §10.5) — matching `SaveSessionListMode`, which already performs its own internal read-modify-write. So do the two rules below: **create-on-absent and abort-on-undecodable are persistence semantics, not policy**, and they belong beside the decode they depend on.

The alternative — exporting a whole-record type with `Load`/`Save` so `cmd` performs the merge literally — was rejected: it would give any caller an API that can clobber the file wholesale, which is the opposite of what "`prefs` stays dumb" (§10.5) is protecting. Keeping the merge single-sited inside the leaf is what makes §8.8's raw `appearance` round-trip a property of the store rather than a rule every caller has to remember. `cmd` still owns the path, the seam and the logging; `prefs` gains no knowledge of either.

This means the `theme` component is emitted from more than one package — the loader (`internal/theme`), the translation (`cmd/config.go`), and this persister. That is legal and normal: CLAUDE.md's rule is *bind once per package*, and `spawn` and `bootstrap` already emit from several files.

**But a stale whole-file write can silently revert a theme.** Before this feature `prefs.json` had one field with a production writer. It now holds five independently-mutated fields written from three surfaces: instance A, constructed ten minutes ago, presses `s` and writes *its* in-memory prefs, silently reverting the theme instance B just committed. `AtomicWrite` does not help — this is a lost update, not a partial write.

**Every writer must read-modify-write:** re-read `prefs.json` immediately before writing, mutate only its own field(s), and write the merged result. Not novel — the project and hooks stores already do this for their own mutations.

**The RMW re-read uses the non-migrating read** (§10.5). It is a write-path read, not a load — its job is to get the current bytes to merge into, and re-entering the translation from inside a write would be both surprising and, since §10.5 allows the marker write to fail and retry, a specified rather than hypothetical state.

**This includes the migration write** (§10.5). Its idempotence argument covers simultaneous cold launches computing the same value, but not the case this rule exists to close: an instance constructed against a pre-migration file flushing stale in-memory prefs and reverting a commit another instance made in between.

**§10.3's no-op condition is evaluated at the RMW re-read, against the bytes about to be merged — never against the load-time snapshot.** Because the translation's write is non-blocking, a user can commit a theme in the window between compute and persist; evaluated against the stale snapshot the pending translation would write `theme = tokyo-night` over the `nord` they just committed and clear the slots, which is §10.3's own failure displaced from cross-launch to intra-process. The same re-read is what lets the migration observe that another instance already set `theme_migrated`.

**An absent file and an unusable one are different conditions, and only the second aborts.**

- **`prefs.json` absent** — there is nothing to merge and nothing to lose, so the write **proceeds and creates the file**. This is the ordinary first write: §8.1 leaves a fresh install with no prefs file at all, so a brand-new user pressing `Enter` on their first theme is the most common write in the product. An abort here would be permanent — nothing else creates the file either, since the `s`-key persister is under the same rule and §8.1 bars the migration from creating it.
- **`prefs.json` present but unusable** — malformed JSON or an I/O failure — **aborts the write; it never becomes an overwrite.** This needs **two decodes, and they must differ**: the *load* path stays tolerant exactly as today (§8.1 — missing, empty or unrecognised falls to the shipped default per field), while the **write-path re-read uses a strict decode that errors on malformed JSON**. Without that split the abort has no trigger at all: a tolerant decode turns a stray comma into a zero-value struct and returns no error, so the writer merges into it. Merging into an empty struct and committing it would erase `session_list_mode`, `theme_migrated`, every untouched theme key and the retained raw `appearance` in a single `s` keypress — the exact loss §8.8 calls out, on the path §13.6 names as the one whose failure is silent and permanent. Nothing is written, `theme: commit failed` is emitted, and the panel reports it (§9.13). **Unrecognised *values* in a syntactically valid file are not "unusable"** — tolerant decode absorbs them by §8.1, and treating them as fatal would make hand-editing prefs a way to lock yourself out. The strict decode judges syntax only. The field-specific save methods (§8.9) use the strict read internally; nothing else does.

This is the same absent-versus-unusable discrimination §5.5 draws for the themes directory and §12.1 draws for export: absence is a normal state, unreadability is a misconfiguration. **§13.6's prefs test covers file creation as well as merge and round-trip** — a suite built only around merging would not catch an abort-on-absent implementation.

**The migration write inherits only the abort half.** It runs at prefs load, before any panel exists, so it has no reporting surface and needs none: it is best-effort and non-blocking by §10.5, the condition is still true next launch, and it retries. It emits **no** `theme: commit failed` — its failure signal is the *absence* of `theme: appearance migrated`, which §10.5 already designs for, and which keeps the commit-failed event single-sited on the theme persister (§8.9). What it does inherit is the rule that matters: **a re-read that does not decode aborts rather than overwrites.**

**"Skip" means skip the theme keys, not the whole write** — the marker is still recorded, so the translation does not stay pending forever. And once a mid-session commit supersedes the translated value, **the commit is the model's active theme**: the translation's in-memory result was only ever the starting value for a launch nobody had chosen a theme in.

`prefs.json` continues to go through `fileutil.AtomicWrite`, so all three theme keys land in one atomic write and partial failure is impossible.

## 9. The slide-over panel

### 9.1 Shape and placement

A **full-height, right-edge, non-blanking overlay** with a **left border only** — deliberately *not* an inset bordered panel like the modals, so it reads as a slide-over rather than a floating dialog.

**A modal was never available, and this is the constraint the whole shape follows from.** Portal's modals **blank the page to the canvas** before drawing (`modal.go` clears to canvas, then `placeModalOnClearedCanvas`). A modal theme picker would therefore render the canvas plus its own frame and **preview nothing** — and live preview is the feature. Non-blanking is not a preference; it is the only shape that can do the job.

Everything downstream inherits from it: the ~24–30 column budget (§9.8), the four-element row-composition priority and truncation floor it forces (§9.5), the message-slot truncation rule (§9.1), §14A's *"in the panel the wording is a layout constraint as much as a copy choice"*, and the accepted cost below of covering three footer entries and cutting a label mid-word. A reader may reasonably ask why a centred modal — which costs no footer at all — was not used: because it costs the entire preview. The same constraint is why §9.2's confirm is inline rather than a modal, and it is the deeper of the two reasons §9.6 refuses the Preview page.

- The Sessions (or Projects) list stays fully visible behind it and re-themes live.
- Rendered over the existing overlay mechanism (`overlayHelpOnPreview` / the lipgloss v2 `Compositor` with real z-layers), which already ships.
- **The panel body is painted `canvas`; the left border is `border`.** No new token. The panel is therefore distinguished from the list behind it by its left border alone — which is the correct reading of a slide-over that is deliberately not a floating dialog.

  The reference frames use a panel chrome of `#0C0C16` on a `#2B3050` border — a near-black *slightly* off the canvas, and a border lighter than `border`. **Neither is adopted.** They are per-frame literals of exactly the kind §9.14 cautions about, and expressing that distinction would need a 20th token whose only role is "the panel's background is a bit different from the canvas" — which fails the vocabulary's own promotion rule (a new token only where the value genuinely differs in role, not in shade) and would reopen §2.1's closed count for a difference nothing else in the app needs. Every panel surface resolving to an existing token is also what keeps §2.1's colour-literal guard and §13.4's swap-and-diff guard satisfied without a carve-out — the carve-out §9.11 exists to refuse.
- **Cursor row** uses the shipped selection treatment (`▌` + tint + white bold name), so the panel's list reads as the same kind of list as Sessions.
- **The panel does not animate.** "Slide-over" names the *shape* — full-height, right-edge, left-border-only, as against a floating dialog — not a motion idiom. Opening and closing are instantaneous, one frame each. Portal has exactly one animation today (the loading page), and an animated open would interact badly with three pinned behaviours: §11.3's OSC 11 emission would fire repeatedly through a canvas-bearing slide, intermediate panel widths would render frames no fixture covers, and `t` followed immediately by `Esc` would need a race resolved.
- **A vertical keymap footer** (`⏎ set theme` / `d set as dark` / `l set as light` / `esc close`) rather than Portal's horizontal footer row — a horizontal keymap does not fit a ~30-column panel, and the vertical form matches the help modal's key-column idiom.

**Header.** The label is **`Themes`**, rendered in `accent.mode` — the token whose role is signalling a distinct mode, which is what the panel is — **preceded** by a one-row `border` rule, matching the Sessions section-header idiom minus the count. **Rule then label, in that order**: the rule runs through the border column and sits in the page's own rule lane, which is what lands `Themes` on the page's section-header row. **No theme count** — noise at this list size. The panel's header region is measured off the page's own header and section-header blocks, so `Themes` lands on the `Sessions N` row and the panel's first row on the page's first session row; below the height that affords those alignment rows the header degrades to a compact two-row form (rule then label), and it is that compact cost — never the page-aligned one — that §9.8's minimum-height rule resolves against.

**Message slot.** A single-row region directly above the vertical keymap footer, **not reserved when empty** — it appears and the list shrinks by one, the same way the main screen's notice band recomputes list height. It is a **single-slot arbiter** with two contenders, which can never be live at once because a confirm resolves before any write happens:

1. The **slot-from-constant confirm** (§9.2).
2. A **failed commit write** (§9.13).

At the minimum panel width the slot may wrap to two rows — it is not a list delegate, so wrapping costs nothing to pagination. **It does cost a row of vertical budget, so at the minimum *height* the message is truncated to one line rather than wrapped.** §9.8's floor counts exactly one message row, and both contenders are non-suppressible; a two-row message there would leave zero list rows or overflow the frame. Truncation is the only option that keeps the panel coherent, and it degrades a message the user is being asked to answer rather than the row they are answering about.

**Every panel surface's token, so nothing is left to the frames** (§9.14 forbids reading values off them) and §13.4's guard has no carve-out to make:

| Surface | Token |
|---|---|
| Panel body | `canvas` |
| Left border, header rule | `border` |
| Header label `Themes` | `accent.mode` |
| Cursor row | the shipped selection treatment — `bg.selection` tint, `accent.primary` `▌`, `text.on-selection` name |
| Valid row label | `text.primary` |
| `●` / `● dark` / `● light` badge | `accent.primary` — the badge marks *assignment*, which is the primary-accent role Portal already uses for active dots and the selector bar; `state.positive` would wrongly imply liveness, which is what `●` means on the Sessions list |
| Invalid row label | `text.subtle` — **not `text.faint`**: §2.5 and §13.5 make `text.faint` decorative-only and *forbid* it reaching the UI floor, but this label is the filename or slug the user must read to know which of their files is broken (§9.4's whole justification). `text.subtle` is the de-emphasised-but-readable step, which is exactly the role. |
| Invalid row `⚠` and its terse reason | `accent.attention` — §2.5 assigns the warning glyph to it, and the reason is part of the same signal. The `⚠` keeps its own token rather than inheriting the row's `text.faint`, so the invalidity signal stays legible on a row that is deliberately dimmed |
| Pinned `⚠ dir unreadable` row | same as an invalid row — `accent.attention` glyph and text |
| Vertical keymap footer | key glyphs `accent.key`, labels `text.muted` — the same split the horizontal footer uses |
| Message slot — confirm | `text.secondary`, no band |
| Message slot — failed commit | `⚠` and text in `accent.attention`, **no `bg.attention` band** — the warning band is a full-width main-screen flash treatment and would read as heavy inside a 24–30 column panel |

These assignments also feed §13.4's third assertion (every token exercised by at least one fixture): the panel fixtures are what cover `accent.mode` and `accent.attention` outside their transient main-screen states.

**What the panel covers:** the right-hand column — the right-side header hint, session row meta, and the right end of the footer, which after §14.1 is `x projects · t theme · m multi` plus the right-aligned `? help`. **Accepted**, on two grounds: the theme is carried almost entirely by the *left* of the screen (session names, cursor bar, group headers, the footer's leading key glyphs), and the overlay covers the least theme-informative part of the screen, which is exactly what a preview surface wants. Note the mild irony that the panel's own key is now one of the entries it covers.

**The overlay cuts wherever its left border falls, mid-label included** — `x proje▏`. That is not a violation of §14.4's "never truncate a label": §14.4 governs how the footer *lays itself out* as the terminal narrows, and the panel is an opaque layer composited over a footer that laid out at full width. **The main screen is deliberately not re-laid-out while the panel is open**, which is what keeps the swap the O(1) restyle of §11.1 and keeps the surface being previewed from reflowing under the user — the opposite of what a preview wants. Reflowing to the reduced width would produce a cleaner edge and was rejected for that cost.

### 9.2 The interaction model — picker idiom, not settings panel

| Key | Effect | Panel |
|---|---|---|
| `↑` / `↓` | Move the cursor. **The app re-themes live behind the panel. Nothing is written.** | stays open |
| `Ctrl+↑` / `Ctrl+↓` | Page, per MV spec §12.2 | stays open |
| `Enter` | **Commits a constant** — writes `theme = <selection>`, clears both slots | **stays open** |
| `d` | **Commits the dark slot** — writes `theme_dark = <selection>`, clears the constant | stays open |
| `l` | **Commits the light slot** — writes `theme_light = <selection>`, clears the constant | stays open |
| `Esc` | **Closes.** Discards an uncommitted preview and renders the resolved persisted state | closes |

**Opening state: the cursor lands on the theme that is actually rendering, and opening previews nothing.**

- Under a **constant**, that is the constant's row.
- Under an **adaptive pair**, it is the row for the slot currently in force — the light slot in a light terminal, the dark slot otherwise. The other slot's row still carries its `● light`/`● dark` badge; only the cursor is singular. When both slots name the same slug there is one row carrying `● both` (§9.5), and the cursor is on it.
- When the resolved theme is a **fallback** (§8.5), the cursor lands on the **fallback's** row, not on the persisted-but-broken one. The persisted row is unselectable (§9.5) and the arrows are specified to skip it, so parking the cursor there would put it somewhere navigation cannot return to — and it would show a row that is not what is on screen. The `●` still marks the persisted slug, which is exactly the split §9.5 draws: `●` is what is *set*, the cursor is what is *previewed*.

Because the cursor starts on what is already rendering, **opening the panel never changes which theme is shown** and the mixed-mode flash fires only on deliberate navigation.

**It can change that theme's *values*, and that is correct.** §5.8's fresh enumeration supersedes the construction-time parse, so if the active theme's file has been edited mid-session the panel holds the truth and opening applies it. Precisely:

- **Edited and still valid** — the panel re-renders the *same slug* with its new values on open. The user edited the file to see the change; making them arrow away and back to trigger it would be a bug wearing a rule's clothing.
- **Edited and now invalid** — the active theme is no longer loadable, so opening resolves the §8.5 fallback and the cursor lands on the fallback's row, exactly as it does for a theme that was already broken at construction. The `●` stays on the persisted slug, whose row is present and unselectable with its reason. The flip happens on **open**, not deferred to `Esc` — deferring would leave the panel listing a theme as invalid while the screen still renders it.

The invariant that survives both cases: **the cursor is always on a selectable row, and that row is always what is painted behind the panel.**

**Every write is an explicit keypress; nothing writes on close.** This eliminates the "applied but not persisted" state reachable under persist-on-close, where Portal dies with the panel open and the visually-applied theme was never written.

**`Enter` does not close.** If it did, a user who had just set both slots would press `Enter` to exit and thereby commit a constant, wiping the pair they just built. `Esc` is the only way out — one exit key, no dual-purpose keys, and the pair flow needs no special case.

**Cost accepted:** the common case ("pick one and go") is two keys rather than one.

**A successful commit recomputes the panel's full row set, not just the badges.** Badges obviously move — §9.13's "a failed commit does not move the `●`" only means anything because a successful one does — but a commit can add or remove rows outright:

- `Enter` clears both slots, so a `not found` or charset-rejected row that existed *only* because a slot named it loses its reason to exist and **disappears**.
- `d`/`l` on a constant makes the other slot live (§8.2). If that slot names a slug with no file and no built-in, §9.4 requires it to have a row — and the open-time union never minted one, because a `theme`-wins file's slots are not read at all. So a row **appears**.

**The recompute uses the construction-time snapshot plus this instance's own mutation — never the merged bytes the RMW just read.** The commit's read-modify-write (§8.9) necessarily has another instance's writes in hand, and re-deriving from them would make badges and rows jump to another instance's choices at the moment the user presses a key: the cross-instance sync §8.4 declines, arrived at through the write path instead of the open path.

**Accepted residue:** after a concurrent commit elsewhere, this panel's `●` for the *other* instance's slot shows what this instance knows rather than what is on disk, until relaunch. That is the same per-instance staleness §8.9 already accepts for every prefs field with last-write-wins, and it is confined to a slot the user is not acting on.

So a commit re-derives the union (§9.4), re-sorts it (§9.5), and **re-anchors the cursor to the previewed theme's identity, never to its index**. Anchoring to an index would silently break §9.2's invariant the moment a row is inserted above the cursor: the screen would keep previewing one theme while the cursor sat on another. The directory is *not* re-enumerated — §5.8 pins that to panel open, and a commit changes prefs, not the directory.

**Committing to a non-active slot changes nothing on screen.** Previewing a light theme in a dark terminal and pressing `l` writes the light slot, but the resolved-active theme is still the dark slot. A commit is a **write, not a navigation** — the panel keeps previewing whatever the cursor is on; the display resolves from persisted state only on close.

Which sharpens `Esc` precisely: **`Esc` discards the preview and renders the resolved persisted state.** That equals "what you had before" only when nothing was committed. Commit slots and `Esc` lands on the newly-resolved theme, which is correct.

**Assigning a slot while a constant is set asks for confirmation first.** This is the one place a keypress described as inert can silently cost the user a setting they chose: on `"theme": "nord"`, pressing `l` clears the constant, the untouched dark slot falls back to the shipped default, and `Esc` in a dark terminal lands on `tokyo-night` rather than `nord`.

- `d`/`l` on a constant raises an **inline confirm in the panel's message slot** (§9.13) naming the constant that will be cleared.
- While the confirm is live it is **key-exclusive within the panel** and resolves on exactly three inputs:
  - **`y` or `Y` confirms** — the constant is cleared and the slot written, in one atomic prefs write.
  - **`n`, `N` or `Esc` cancels**, leaving the panel open and nothing written. `Esc` cancels the confirm rather than closing the panel, because the innermost thing resolves first — the same nesting rule §9.7 applies to the panel over multi-select.
  - **`Ctrl-C` quits Portal**, per §9.7. It is not a cancel; it stays live everywhere.
- **Every other key is swallowed** — arrows, `Enter`, the other slot key, all of it. The confirm persists until one of the three above resolves it. Nothing has been written yet, so there is no partial state to leave behind.
- **The panel footer switches to the confirm's own keys while it is live** — `y confirm` / `n cancel` — and switches back when it resolves. The standing footer advertises four keys of which none would act during a confirm, and §14.3 is firm that advertising a key that will not act is the dead end a proactive block exists to prevent.
- **The confirm's keys live in the descriptor as a nested confirm scope** under the panel scope (§9.12), so its footer renders from the descriptor like the panel's and `keymap_dispatch_guard_test` covers `y`/`Y`/`n`/`N` too. §9.12's "all six" is the panel scope's own membership; the confirm is a second scope, not a sixth-plus-four list.
- It is **inline, not a modal** — the panel does not blank, and stacking a modal over an overlay is the shape §9.6 rejects for the Preview page.

**The reverse direction needs no confirm.** `Enter` on a theme while a pair is set clears both slots — but `Enter` visibly does what it says: you get the theme you are looking at, and it is the theme already previewing behind the panel. Nothing is surprising, so the confirm would be friction for its own sake. The asymmetry is the point: the confirm guards the case where the *resolved* theme changes as a side effect of a write the user was told is inert.

**The mixed-mode flash is the feature, not a defect.** Under split plus apply-on-arrow, arrowing past a light theme in a dark terminal flips the entire canvas near-white and back. Seeing a light theme as designed is precisely what live preview is for, and under the picker idiom it is transient and reversible. **List order is alphabetical by slug**; ordering same-mode themes first was proposed as a mitigation and **rejected** as unnecessary once the flash is accepted.

### 9.3 Mid-session constant → adaptive

Assigning a slot converts a constant-theme user to adaptive in-session, which needs a light/dark answer their launch deliberately never waited for.

**This dissolves.** `restore.go` issues the OSC 11 query from `Init` **regardless** — it needs the original background to restore on exit, independent of detection. The terminal's background is therefore already in hand; the detection decision only ever governed whether to **classify and use** it. Converting to adaptive mid-session starts using an answer that already arrived: no new query, no race, no gate.

The startup win survives intact — skipping the gate for constant users is about not **blocking first paint**, not about not asking. If the reply has not landed (requiring the panel to be opened within milliseconds of launch) it falls to **dark**, the same rule as everywhere else.

**The transition's other half is a file, not an answer**, and it does not dissolve: the slot the user did *not* assign was never loaded at construction and becomes live on the same keypress. §8.4 specifies that load.

### 9.4 The list — files ∪ whatever prefs names

**Every `*.theme` file in the themes directory gets a row, plus every built-in, plus any slug named in `prefs.json` that resolves to neither.**

**"Resolves", not "has a file"** — the distinction is load-bearing, and doctor already uses the right vocabulary (§12.2: "reports when a persisted theme name no longer *resolves*"). A built-in is embedded, not a directory entry, so keying the union on file-existence would mint a second `⚠ not found` row for every persisted built-in slug — which is the state produced by the panel's most common action, pressing `Enter` on `tokyo-night`. **One slug is one row**, always: a persisted slug that names a built-in *is* that built-in's row, and a persisted slug that names an existing-but-invalid file *is* that file's row, carrying both the reason and the badge.

- Enumerating every file means an invalid theme is *present and named*, so the user sees "there's my theme, it's registered, but it's invalid" rather than being completely in the dark about why it did not appear.
- A persisted slug that **resolves to nothing** — no built-in and no file — gets a row of its own: marked, unselectable, reason `not found`. Same shape as an invalid file: the user sees what is set and why it is not applying. This covers a deleted file, a renamed file, and a typo in `prefs.json`.
- A persisted slug **rejected by the charset check** (§8.6) before any file is sought gets a row with reason **`bad name`**, not `not found` — the reason maps to the actual failure, and each §6.2 reason has exactly one condition. Telling a user their file is missing when they typed an illegal name sends them looking in the wrong place.
- Applies **per-slot** under an adaptive pair with one dead or broken slug.

This is what makes the `●` marker always have something to sit on, so it keeps meaning "this is what's persisted" and nothing ever implies the fallback was chosen.

A **skipped-count line** (`⚠ 2 theme files skipped`) was the earlier design and is **superseded** by per-file rows: the row is present and named instead of a count that sends the user to another command to discover which file and why.

### 9.5 Row rendering and markers

**Valid rows** are selectable and render as an ordinary list row.

**Built-in rows are deliberately indistinguishable from drop-in rows** — a valid drop-in is simply selectable, sitting alphabetically among the built-ins with no visual distinction.

**Invalid rows** render their label in `text.subtle` (§9.1 — de-emphasised but readable, since the user must be able to tell *which* file is broken) with `⚠` and its §6.2 reason — **glyph-backed** per MV spec §2.2 so it survives colourless. Full detail stays in doctor, where there is width to enumerate.

**A `bad name` row is labelled by its filename**, not a slug — it has none, because §5.2 rejects rather than normalises. The same applies to its position in the list: **ordering is alphabetical by slug, falling back to the filename for a row that has no slug.**

**A `reserved name` row is likewise labelled by its filename.** Its slug is valid, but it is *identical* to the built-in's — labelling by slug would put two rows reading `nord` in a list where §9.5 deliberately makes built-in and drop-in rows indistinguishable. `nord.theme` beside `nord` tells the user exactly which one is theirs, and it sorts adjacent to the built-in it collides with, which is where the explanation is most useful. The terse reason stays `reserved name`; doctor carries the sentence naming the conflict.

**Sort key and display label are separate, and the sort key is fully determined:**

- The **sort key is the slug** wherever one exists — including a `reserved name` row, which is why it sorts adjacent to the built-in it collides with despite being *labelled* by filename. A `not found` persisted-slug row sorts by its slug too.
- Only a **`bad name`** row has no slug; it sorts by **filename**. A **persisted string rejected by §8.6's charset check** has neither a slug nor a file — it sorts by **the persisted string itself**, control-stripped and truncated as it is for display. There is exactly one thing to sort it by, and using it keeps the ordering total.
- Comparison is **case-insensitive, with a byte-wise tie-break**. Slugs are lowercase by construction, but filenames are not, and a byte-wise-only comparison would file `Zed.theme` ahead of every valid theme.
- **One tie is guaranteed by construction and the byte-wise tie-break cannot settle it: a `reserved name` row and the built-in it collides with have the identical sort key**, since `reserved name` is *defined* as that collision (§6.2). **The built-in sorts first**, then the rejected file. That is the useful order — the valid, selectable thing the user can act on, immediately followed by the row explaining why their file is not it — and it is what makes §9.5's adjacency argument concrete rather than incidental. It also makes the panel fixtures deterministic (§13.3), which a sort left to chance would not.
- The `⚠ dir unreadable` row is **outside the ordering entirely** — it is viewport chrome, not a list member (above).

**A slug that came from `prefs.json` is control-stripped at the point it is read, not at the point it is drawn** — it is a property of the value, so every consumer inherits it. §8.6 validates it before *use* as a path component, but a charset-rejected value is still *reported* (§9.4), and it reaches two surfaces: the panel row and doctor's advisory line (§14A). A pasted newline, tab or ANSI escape would otherwise corrupt whichever of them the user is reading to find the problem. **Truncation is separate and stays panel-local** — doctor has full width and wants the whole value.

**A slug arriving as a CLI argument is control-stripped the same way**, at the point `portal theme export` reads its argument. Export never reads prefs (§10.5), so it is not covered by the rule above — but §14A echoes the argument back on stderr (`no theme named <slug>`), and an argument can carry a pasted escape exactly as a prefs value can.

**Row composition — one row per theme, always.** An invalid row never wraps to two lines: every list row is exactly one delegate line, which is the invariant `bubbles/list` pagination depends on and which §9.8's paging and the invalid-row skip both rest on. The elements compete for a fixed ~24–30 columns in this priority order:

1. **The `⚠` glyph** — always rendered on an invalid row. It is the invalidity signal and costs two columns.
2. **The `●` badge** (`● dark` / `● light` / bare `●`), right-aligned, when the row is a persisted slot. §9.4 exists so the marker always has a home, so the badge outranks the reason.
3. **The label** — slug, or filename for a `bad name`/`reserved name` row (above). Truncated with `…` to fill the space left, down to a floor of three visible characters plus the ellipsis.
4. **The terse reason**, right-aligned — **the first element dropped** when a badge competes for the same edge. `⚠` still says the row is invalid and doctor says why, which is exactly the split §6.3 draws.

Below the label's truncation floor the panel is already at §9.8's refuse threshold, so no further degradation rule is needed.

**An unreadable themes directory gets its own row** (§5.5) — `⚠ dir unreadable`, **chrome pinned to the viewport directly beneath the header, not a list row.** It is deliberately *not* a `HeaderItem`-style delegate like the Sessions group headers: a list row participates in pagination, so the warning would vanish the moment the user paged down — and §9.5 justifies the row as what stands between the user and the "completely in the dark" state, which a page-1-only warning does not do. As chrome it is always visible and needs no arrow-skip rule.

Two consequences follow from it being chrome:

- **It costs a viewport row while present, so §9.8's minimum-height floor gains it conditionally** — header + footer + one row + one message row, **plus this row when the directory is unusable**. Otherwise at the floor the warning would consume the single list row and nothing selectable would render, while §9.5 simultaneously requires built-in and persisted-slug rows to render beneath it.
- **It is not counted by `theme: enumerated`'s `count`** (§12.3), which counts rows produced by the §9.4 union. It is chrome, not a member of the union. **Its copy is deliberately short (16 columns) so it fits the panel's minimum width without truncation**, because it is the one row §9.5's composition rules cannot degrade: it has no label, no badge and no reason, so none of the four priorities apply, and the truncation-floor argument does not transfer to a fixed string. It is also the row that must not become nonsense — it is what stands between the user and the "completely in the dark" state. The panel header's `Themes` label supplies the context the copy drops. Without it every drop-in silently vanishes and the user sees only built-ins: the exact "completely in the dark" state §9.4 exists to prevent, in the surface it was chosen to prevent it, at the moment the user is standing there to pick a theme. **Built-in rows and persisted-slug rows still render beneath it** — the persisted rows especially, or a user with an unreadable directory loses the `●` entirely. Full detail stays in doctor (§12.2).

**Arrow keys skip invalid rows**, reusing the mechanism that already skips group-header rows on the Sessions list. The skip composes with paging exactly as the group-header skip already does.

**Markers — treatment A (inline slot badges):**

- The assigned rows carry a right-aligned **`● dark`** / **`● light`** badge.
- **When both slots name the same slug, that one row carries `● both`.** This is reachable in two keypresses (`d` then `l` on one row) and is a likely path — it is where a user lands wanting "this theme everywhere" without realising `Enter` is the idiom for it. `● both` is chosen over a combined `● dark light` because with exactly two slots "both" is fully determined, and it is no wider than `● light`, so it does not move the truncation budget §9.5 fixes.
- A **constant** theme carries a bare **`●`** with no slot word — with no slots there is nothing to qualify, and a label would be redundant with the marker.
- The two setting states never coexist on screen, so a row never carries a constant's form and a slot's form together.

The `●` glyph is correct here: Portal **already repurposes** `●` for multi-select marking, where it indicates a marked row rather than a live session. `●` is Portal's general "marked / active" glyph, not an attached-only one. The two signals stay independent: **`●` marks assignment**, the **`▌` + tint cursor treatment marks browse position**.

Treatment **B** (a `dark → … / light → …` key-value block pinned under the panel header, with a plain list below) was rejected: more legible at a glance, but it puts theme names in a second place, pushes the list down, and with only two slots the badges say the same thing without the extra region. A also scales better as the library grows, since a badge stays attached to the row it describes.

**Accepted caveat:** with a very long list the assignments could scroll out of view. Judged fine — a user knows what they picked and can scroll to find it.

**The badge marks the slug a slot resolves to *before* fallback.** One rule covering all three cases, which §8.4's "the badge needs the persisted slug" and the shipped-default reading each cover only part of:

| Slot state | Badge sits on |
|---|---|
| Set and loadable | The persisted slug |
| Set but unloadable (§8.5) | Still the **persisted** slug — a fallback never moves the badge; the `●` means "what is set", and the fallback's own row carries no badge |
| Never set | The **shipped default's** slug (§8.3) — `tokyo-night-day` carries `● light`, `tokyo-night` carries `● dark` |

The third row is what makes §9.4's justification for the whole union true — *"the `●` marker always has something to sit on"* — including on a brand-new install, where §8.1 leaves `prefs.json` absent entirely and a persisted-slug-only rule would show no marker anywhere at all. It is also the one place §9.9's inherited-default-versus-pin distinction is visible to a user, which is a reason to show it rather than a reason not to.

**Because the panel shows both slots' badges at all times**, a user can see what light is set to without having to remember whether they set it. A commit on a virgin install therefore does visibly change the badges — `Enter` collapses two slot badges to one bare `●` — which is correct: the user has just converted two inherited defaults into one pin.

### 9.6 Opening the panel — `t`, on Sessions and Projects

**Key: `t`** — free on Sessions (taken there: `/ s x m k d e r ? Space Enter Esc` plus arrows) and the obvious mnemonic.

| Page | `t` |
|---|---|
| **Sessions** | Yes — the default page and the richest surface to preview against |
| **Projects** | Yes — theme is a *global* setting; refusing would make it feel page-scoped for no reason, and `t` is free there |
| **Preview** | **No.** The preview body is captured real ANSI scrollback that is deliberately out-of-theme, so live preview would only re-theme the frame chrome — a weak surface. It is also already a full-screen overlay, so the panel would stack an overlay on an overlay. |
| **Loading** | **No**, and **silently** — the loading page is inert by design (animation only), which is what contains the restore/daemon race surface. On the cold + TUI path it holds for at least `LoadingMinDuration` with the user watching, so it is not a corner case. Silent rather than flashed, per the rule below: `t` is not bound there, and the loading page renders no notice band to flash into. |
| **Modals** | No — modals are key-exclusive by design |

**`t` needs the filter carve-out** — while `/` is focused it is a literal filter character, exactly as `s` already is.

### 9.7 Entry conditions and input routing

**Nothing blocks `t` except a modal, a pending burst, `NO_COLOR`, a terminal below the render floor, and the pages where it is not bound at all (§9.6 — Preview and Loading).**

- **Below the render floor** (either dimension, §9.8) — `t` refuses with a flash rather than opening a broken frame. This is a third shape alongside the two below: the key is bound and the panel is available in principle, but there is no room. It flashes like the `NO_COLOR` case for the opposite reason — §9.10 draws that distinction deliberately, capability absence versus space shortage — and §14A pins a string per dimension. It is an **entry** condition, not only the resize condition §9.8 describes.

- **Multi-select** — `t` opens, and the marked set is **unaffected**. The panel *nests* over the mode and `Esc` resolves innermost-first (closing the panel and returning to multi-select with selections intact), which is what MV spec §8.1 already specifies for modals. The multi-select banner sits in the notice band on the left, so it stays visible behind the panel. Previewing mid-selection is legitimate — the marked-row `●` is itself themed.
- **A pending burst** — `t` is swallowed. The burst input-locks the model (only `Ctrl-C`/`Esc` live) because it is mid-async-operation; swallowing is consistent with that lock rather than an exception to it.
- **Modals** — capture keystrokes, so no `t`, per existing key-exclusivity.
- **Sessions and Projects normal view** — always available.

**The panel is key-exclusive.** It owns arrows, `Enter`, `d`, `l` and `Esc`; everything else is swallowed **except `Ctrl-C`, which stays live**. Pass-through is genuinely bad — `k` would kill the highlighted session while you pick a theme, `x` would swap to Projects with the panel open, `m` would start a multi-select behind it. None of that reasoning reaches the global quit, and swallowing it would take away the user's exit key inside a settings surface. This matches the burst input-lock, which keeps `Ctrl-C`/`Esc` live for the same reason. Non-blanking and key-exclusive are not in tension: seeing the list without being able to drive it *is* the live-preview premise.

**Blocked-`t` feedback follows the existing precedent:** **flash** where the key *is* bound and the user could reasonably expect it to work (`NO_COLOR` on Sessions/Projects); **silent** where it is not bound at all (Preview, modals, burst-locked). That is exactly how `s` already behaves.

### 9.8 Geometry — degrade, don't refuse

**Width.** A fixed preferred width of ~24–30 columns (name, markers, slot indicators, border, padding), with long user slugs truncated `…` as Portal already does for session names. A fixed width is predictable to lay out against; content-driven width would make the panel jump around as the library changes.

**Narrow terminals degrade, they do not refuse.** MV spec §2.7's doctrine for space shortage is explicit: degrade, never break.

- The panel **shrinks** between a preferred and a minimum width as the terminal narrows — staged degradation, consistent with §2.7's existing width steps (drop right-side header hint → compact wordmark → truncate names).
- It **refuses only when even the minimum panel cannot render**, which is very narrow indeed — and then it flashes rather than opening a broken frame.
- **Exact thresholds are pinned at implementation**, as §2.7 already does for its own degradation steps.

The multi-select precedent (proactive block at entry) deliberately does **not** transfer: multi-select is blocked because of a capability *absence* — the terminal genuinely cannot spawn windows. A narrow terminal is a space *shortage*.

**Height.**

- **Overflow: scroll**, through the `bubbles/list` machinery, so `Ctrl+↑/↓` paging applies per MV spec §12.2. The invalid-row skip composes with paging exactly as the group-header skip already does.
- **Minimum height: the same degrade-then-refuse rule as width** — shrink the visible row count, and refuse with a flash only when **header + footer + one row + one message row** cannot fit. The message row is part of the floor even though §9.1 does not reserve it when empty: both of its contenders are non-suppressible. The confirm gates a write §9.2 requires not to happen silently, and the failed-commit line is specified to persist until the next keypress — so a floor computed without it would put the panel one row short at exactly the moment a message appears, asking "clear constant `<slug>`?" about a row no longer on screen.
- **Resize while open: degrade in place**, closing with a flash only if the terminal falls below the render floor. The entry condition is not the only check; §2.7's degradation is already per-dimension.
- **A forced close takes the `Esc` path exactly** — it discards an uncommitted preview and renders the resolved persisted state (§9.2). It is the only other way the panel goes away, and any other behaviour would strand the user rendering a theme they never chose, with the surface that could change it now gone and a terminal too narrow to reopen it. That is also the state §11.4 names as the one where a colour the user never chose can survive Portal's exit.
- **A live slot-from-constant confirm is silently cancelled** by a forced close. Nothing has been written at that point (§9.2), so there is no partial state to leave behind — but it is stated because the confirm is otherwise specified as resolvable only by a keypress.

### 9.9 No unset — accepted

Every panel action *sets*: `Enter` sets a constant, `d`/`l` set a slot, nothing clears. So returning to the shipped pair after setting `theme_dark = nord` means explicitly setting `tokyo-night` — which resolves identically today but converts an **inherited default into a pin**, so a future change to the shipped default would no longer reach that user.

**Accepted and documented rather than fixed with a clear key.** It only bites if the shipped default changes, and `prefs.json` is hand-editable.

### 9.10 `NO_COLOR` — the panel is blocked

Under `NO_COLOR` Portal paints no canvas, imposes no hues, and renders glyph-backed on the terminal's native fg/bg. A theme panel previews nothing, its cursor tint and slot dots have no colour, and committing persists a choice with zero visible feedback.

**`t` is blocked under `NO_COLOR`, with a flash**, following the multi-select precedent exactly — proactively blocked at entry rather than letting the user walk into a dead end. **The `t` help row is filtered out while blocked**, via the same `sessionsHelpKeymap()` call-site filter that already drops the `m` row (the static descriptor is unchanged, so the keymap dispatch guard stays green).

This is deliberately the **opposite** call to the narrow-terminal one. Narrow is a *space shortage*, where §2.7 mandates degrade. `NO_COLOR` is a *capability absence* — there is no colour to theme, so the panel's purpose is inert rather than cramped.

**Under `NO_COLOR` the theme machinery still runs normally, unchanged.** Nothing branches on it below the render layer:

- **Both nominated themes are still loaded** at construction. Two file reads whose values are then not painted is the honest cost of not special-casing the loader — and the alternative (skip loading under `NO_COLOR`) would mean a theme commit made in that session had nothing in hand to persist against.
- **The gate is skipped** (`NO_COLOR` already suppresses detection today), so the standing **dark** no-answer fallback selects the active member. `theme: loaded` is emitted as normal, one line per nomination.
- **The startup canvas hex is captured as normal** from the selected member, so `RestoreTerminalBackground` has a defined comparison value — but no canvas is painted and no OSC 11 set is issued, so there is nothing to restore and the set-back is a no-op. The §11.4 anchor test does not need a `NO_COLOR` case: the value is defined and unused.

**Counter:** someone may run `NO_COLOR` in one context and not another, so blocking prevents setting a theme that *would* apply elsewhere. Accepted, because the escape hatch is first-class — `prefs.json` is the documented hand-editable home for the theme setting, so three keys can be set by hand.

### 9.11 Everything re-themes, panel included

**The slide-over's own chrome re-themes with the previewed theme. No exceptions.**

1. It is the honest preview — the panel is part of what the theme paints, so a fixed panel shows a theme that cannot be fully judged.
2. It avoids a **permanent exception in the render layer** — a surface that deliberately ignores the active theme is precisely the shape the swap-and-diff guard exists to catch, so the alternative would mean carving out the one test protecting against accidental carve-outs.
3. The unreadable-panel risk is smaller than it looks, because **`Esc` is a keypress, not a visible affordance** — no need to read the hint to close the panel. The picker idiom does the rest.

**Residue:** since a drop-in need only be *valid*, not good, a legal-but-awful theme can render the panel's own list unreadable while the user is standing on it. A user can only get *stuck* there by explicitly committing one, and recovery is then editing `prefs.json` rather than anything in the UI. Since a drop-in is by decision the user's own creation and only they can reach this state, that is judged proportionate — but it is a real edge.

### 9.12 The panel's keymap is descriptor-governed

The panel introduces `Enter`, `d`, `l` and `Esc` through a bespoke vertical footer outside `keymap.go` — a second place a key label can go stale, the very drift class guarded elsewhere.

- **The panel's keys live in the keymap descriptor as a panel scope** — **all six**: `↑`/`↓`, `Ctrl+↑`/`Ctrl+↓`, `Enter`, `d`, `l`, `Esc`. The descriptor must be complete or the dispatch guard's descriptor↔dispatch parity is what breaks.
- **Its vertical footer renders from the descriptor, filtered to the `Core` entries** — `Enter`, `d`, `l`, `Esc`. Arrows and paging are present in the descriptor as **non-core**, which is exactly the distinction §14.1 applies to arrows on the main footer, for the same reason: arrows in a list are a given. That is how the six-entry descriptor and §14A's pinned four-row footer are both satisfied without either being a special case.
- **`keymap_dispatch_guard_test` covers them.**
- **`?` does nothing inside the panel.** It is swallowed with everything else (§9.7) — there is no panel help modal, and the panel scope exists to drive the vertical footer and the guard, not a help body. The panel's four commits are already listed in front of the user; a help modal over a non-blanking overlay would also stack the shape §9.6 rejects.

### 9.13 A failed commit write

A failed write on `Enter`/`d`/`l`:

- **Reports in the panel's message slot** (§9.1) — `⚠` plus a terse statement that the theme could not be saved, glyph-backed per Portal's convention. It **persists until the next keypress** rather than timing out like a transient flash: it reports a state the user must act on, and a message that vanishes on its own can be missed in the surface where the only other feedback is the `●` deliberately *not* moving.
- **Keeps the theme applied in memory.**
- **Does not move the `●`** — the marker means "what is persisted" and would be lying if it moved.

This recreates "applied but not persisted", but as a *reported* state rather than a silent one, which is the distinction the picker idiom was buying.

**The report must survive the panel closing.** `Esc` is the only way out and it re-resolves from persisted state (§9.2) — so composed naively, the very next keypress both clears the message and drops the theme the user chose, with no `●` movement to signal it (§9.13 correctly forbids that) and nothing on the main screen. The "reported rather than silent" property would hold for exactly one keystroke.

**"Outstanding" is a state, not a message.** A commit failure is outstanding from the moment a write fails until a **subsequent commit succeeds** — nothing else clears it. In particular arrowing away does not: that dismisses the *message* (which persists only until the next keypress) while leaving the state, which is what stops the very next `Esc` reinstating the silent revert this section exists to close. And because a successful retry clears it, a `d` that fails followed by an `l` that succeeds raises no flash — the user is not told a theme was not saved when it was.

**So closing the panel with a failed commit outstanding raises a main-screen flash**: `theme not saved — see portal.log`. The copy carries no `⚠` of its own — the notice band's warning role prepends the status glyph, as it does for the five other flashes in §14A's table; the panel's own message slot copy (`⚠ couldn't save theme`) keeps its glyph because that surface adds none. **Raising the flash discharges the state** — it is the report the state exists to produce, so once made the state has done its job. Without that, reopening the panel and pressing `Esc` would re-fire the flash about a failure already reported, on every close for the life of the process.

**`Ctrl-C` with a failure outstanding is accepted as an undelivered report.** It is the one exit §9.7 keeps live inside the panel, and the main screen is going away, so there is nowhere to raise a flash. **The log is the record** — `theme: commit failed` is already written (§12.3) — and the alternative, a post-TUI stderr warning, would put a message about a colour preference on the same channel Portal reserves for bootstrap failures.

**On a forced close (§9.8) both flashes are due at once, and the failed-commit flash wins.** The notice band has one slot, and the two report different things: a geometry event the user can see for themselves — their terminal just got smaller and the panel vanished — versus an unsaved setting they must act on, which §9.13 exists to keep from being silent. **The state is discharged**, because the report was made. Losing the geometry flash costs nothing; losing the commit flash on the one path where the user cannot reopen the panel to retry is exactly the failure this section closes. The revert itself is correct and stays — the write did not land, so the theme is not persisted and `Esc` resolving to persisted state is right — but the user is told, on the surface they are left looking at. Accepting the silent revert was the alternative; a flash is the mechanism §14A already pins copy for elsewhere, so it costs nothing new.

**A commit is always re-attemptable.** The commit keys are unconditional writes (§9.2), so pressing `d`/`l`/`Enter` again simply retries — no special retry affordance, and no state to clear first.

### 9.14 Reference frames

**The panel is two halves with opposite risk profiles, and that is why the frames and fixtures are non-negotiable rather than nice-to-have.**

- **The picker half has strong prior art.** Helix's `:theme` re-themes live behind a three-state prompt; Ghostty's `+list-themes` is close to the described layout (list one side, live preview the other, `Esc` to exit); kitty's themes kitten has live preview. A reviewer can check this half against a familiar idiom.
- **The slot half has none.** Assigning a theme to a light/dark slot *from inside a picker* was found in no surveyed tool — Helix, Ghostty, Zellij, kitty and bat all require editing config for the pair. `d`/`l` and the `● dark` / `● light` / `● both` badge vocabulary are genuinely novel. That is not a reason to avoid them; it is the reason there is **no established shape to borrow**, so the Paper frames and §13.3's fixtures are the only reference that exists — and it tells a reviewer where to concentrate the visual gate.

Three Paper artboards are the forward-looking reference for this panel, all built on the canonical `Sessions — Modern Vivid v2` frame so they inherit the shipped MV conventions:

- `Theme slide-over — A (inline slot badges)` — the adaptive-pair state
- `Theme slide-over — A (constant set, previewing another)` — a constant `●` on one row while the cursor sits on a different theme
- `Theme slide-over — B (assignment header)` — the **rejected** treatment, retained as the record of what was weighed

The constant frame completes the panel's specification because the two setting states never coexist on screen. It is the picker idiom made visible: the `●` is what is *persisted*, the cursor + canvas is what is *previewed*, and `Esc` would restore the marked one.

**Caution when reading any Paper frame:** the mocks use **per-frame literal hexes**, so the same token can carry different values across frames. The frames are reference, never truth.

## 10. Upgrade path from `appearance`

### 10.1 The problem

Real installs hold `"appearance": "dark"` or `"light"` today — the README currently *recommends* pinning it. Deleting `prefs.Appearance` makes that field unknown, so tolerant decode silently ignores it, and a user who deliberately pinned `dark` on a light terminal upgrades into the shipped adaptive pair and **silently gets a light Portal** with nothing explaining why. That is the worst outcome for precisely the group who expressed a preference.

### 10.2 The translation

The mapping is exact, which makes the fix cheap: `appearance: dark` meant "always dark regardless of terminal", and the new equivalent is a **constant** theme.

| Existing `appearance` | Action |
|---|---|
| `dark` | Write `"theme": "tokyo-night"` |
| `light` | Write `"theme": "tokyo-night-day"` |
| `auto` | Nothing — ignoring it lands exactly on the adaptive default, which is what `auto` meant |
| absent | Nothing |

Intent is preserved precisely rather than approximately: a pinned mode becomes a pinned theme, and detection stays off for them just as it was.

Portal has the precedent — `migrateConfigFile` performs a one-shot move from the old macOS config path.

Rejected: accepting the silent flip as cosmetic and one keypress to fix. Wrong when the affected users are exactly those who set a preference, and when the translation is this small and this exact.

### 10.3 The trigger is an explicit marker

**The translation is gated on an explicit `theme_migrated` marker in `prefs.json`, not on the absence of theme keys.**

Gating on absence would be re-armable, and it composes badly with the "no unset" acceptance (§9.9), whose documented escape hatch is to hand-edit `prefs.json`: an upgraded user who deletes their theme keys to return to the shipped adaptive pair would get **silently re-translated and re-pinned** on the next launch — Portal reinstating exactly what they just undid.

With an explicit marker: `appearance` is retained, deleting theme keys does nothing, and the trigger fires **exactly once ever**.

**The trigger and the no-op condition are separate things.** The marker decides *whether the translation is still pending*; a check on the theme keys decides *whether there is anything to do*:

- **If any theme key is already set, the translation writes no theme key** — it only sets the marker. This is not absence-gating the trigger (which §10.3 rejects as re-armable); it is refusing to clobber a choice the user has already made.
- Without it, a reachable sequence loses a setting: a user upgrades, runs only bootstrap-exempt commands for a while so the migration never fires, reads the new docs and hand-edits `theme_dark = nord`, then launches the picker — whereupon the still-pending translation pins `theme = tokyo-night` and §8.2's write rule clears the slot they just authored. That is the mirror image of the failure §10.1 exists to prevent.
- **Mutual exclusion still applies** when the translation *does* write: it writes a constant, so it clears the slots. There is simply never anything to clear, because it only writes when all three keys are empty.

### 10.4 `appearance` is retained, not dropped

**The translation adds the theme keys and leaves `appearance` in place.**

Portal ships via Homebrew where reverting a version is routine, and the protected population is exactly those who pinned `appearance`. Dropping the field would mean that post-translation their pin is gone, an older binary reads nothing, falls to `auto`, and resumes detecting — precisely what the translation prevented, displaced in time.

Retaining it is inert to the new binary and still meaningful to an old one, and it removes a schema mutation entirely (which also removes the question of who owns performing the deletion).

**Accepted:** the retained `appearance` is a **frozen legacy value** and is **not** kept in sync with later panel commits. A downgraded binary honours the user's old pin rather than their current choice — which is the most a binary with no concept of themes could do.

### 10.5 Ownership and write-path robustness

**`cmd/config.go`'s `loadPrefsStore` owns the translation.** Three decided constraints meet here: `prefs` is a deliberate leaf that must not import `internal/log`; the translation happens at prefs load; the `theme` log component records it. `loadPrefsStore` already owns prefs path resolution and the migrate breadcrumb for every other config file, and is not a leaf, so it can log. **`prefs` stays dumb.**

**`cmd/config.go` also exposes a non-migrating read variant, for `portal doctor`.** Doctor must read `prefs.json` to report an unresolvable theme (§12.2), but its contract is that it **heals nothing on the read-only path**, and a one-shot config mutation as a side effect of running a diagnosis breaks that. Splitting the read from the migration keeps doctor's "read-only" claim literally true, without relocating ownership of the translation away from `loadPrefsStore` (which is where the logging constraint puts it).

**`portal theme export` does not read `prefs.json` at all.** Its argument is a slug, which resolves by name against the embedded set and then the themes directory (§8.4's ordering) — the theme setting never enters. That keeps it side-effect-free by construction rather than by carve-out.

**The migration therefore runs only where a TUI is constructed** — which is also the only place its result is used, since the exec path constructs no TUI and reads no prefs.

**Separate *computing* from *persisting*.** At prefs load, read `appearance`, compute the translated theme, and **use it in memory immediately**; the write is **best-effort and non-blocking**. A failed write means Portal renders the correct theme this launch and retries next launch (the condition is still true), so it can never flip the user to the wrong theme — which was the translation's entire purpose.

**§10.3's no-op condition governs both halves, and for the in-memory half it is evaluated against the load-time snapshot.** If any theme key is already set, the translation neither writes a theme key **nor applies its computed value in memory** — the user's setting is what renders. Scoping the condition to the write alone would produce a one-launch silent flip on §10.3's own reachable sequence: hand-edit `theme_dark = nord`, launch, and the still-pending translation would render Tokyo Night for that launch and Nord thereafter. That is the failure §10.1 exists to prevent, delivered by the mechanism added to prevent it.

The condition is therefore checked twice against two reads, deliberately: at **load** for the in-memory half (the only moment early enough to affect what is painted), and again at the **RMW re-read** for the write half (§8.9), where it also absorbs a commit made by another instance in between.

**The theme key and the marker land in one write.** §8.9's field-specific save methods each perform their own read-modify-write, so issuing two would leave a reachable window — §10.5's write is best-effort and non-blocking, i.e. explicitly liable to be cut short. A failure between them persists the theme key with the marker unset, and the next launch then finds the marker false, sees a theme key already set, writes only the marker, and therefore never emits the event: the translation succeeded while the log says it failed, which is the one reading §12.3 designs the event to make impossible. The migration therefore uses a combined save rather than two calls.

**`theme: appearance migrated` fires only when a theme key is actually persisted.** A run that writes the marker alone translated nothing, so announcing a migration would be false — and §12.3's "absence is the signal the write failed" stays true only if the event means what it says.

**Concurrency is doubly safe here:** the write goes through §8.9's read-modify-write like every other, and beyond that several burst-launched instances hitting the condition simultaneously all compute **the same value from the same input**, so it is idempotent regardless. It never runs on the exec path, which constructs no TUI and reads no prefs.

The translation emits `theme: appearance migrated` (INFO, one-shot) — see §12.3.

**The translation is silent to the user at runtime.** No flash, no notice band, no banner — the log line is a forensic trail with **no user-facing interruption**. Three reasons, stated because the spec's own reflexes point the other way — §9.13 establishes that a state the user must act on has to be reported, which an implementer could reasonably generalise to a config mutation.

- **There is nothing to explain.** The translation preserves intent exactly (§10.2) — a pinned mode becomes a pinned theme and detection stays off, just as it was. §10.1's problem was the *silent flip*, and the translation is what prevents it; announcing the fix would be announcing that nothing changed.
- **It runs at prefs load, before any surface exists** to render a notice into.
- **The notice band is a single-slot arbiter with six contenders already** — §6.3 refuses it a permanent entry for a rarer event on exactly this ground.

The compensating channel is the CHANGELOG (§12.5), which is required to carry that `appearance` is translated automatically and the user need not act — the honest place for a one-time upgrade notice.

## 11. Live-swap mechanics

### 11.1 Speed is a non-issue

The cheap path already exists and already excludes the expensive one:

- **Restyle** — `applyCanvasMode` swaps the delegate and re-points the cached style structs `bubbles/list` holds. O(1), no I/O, no list content touched. It performs exactly the mid-session restyle a theme swap needs. **Its production caller changes with this feature**: today it runs when a late OSC 11 reply lands after first paint, which §8.8 retires (the gate resolves once); from here its callers are the panel's **arrow-preview**, its **open** (when a mid-session file edit changes or invalidates the active theme, §9.2) and its **close** — `Esc`, and the forced close that takes the same path (§9.8). A *commit* is not a caller: it recomputes rows and badges, never the rendered theme (§9.2). The close path matters most — a missed re-point there leaves a preview the user explicitly discarded painting the main screen, and §13.4's guard drives the arrow-preview entry point only. The mechanism is proven, not the caller — so §13.4's guard is driving an existing entry point with a new set of callers, not building one.
- **Rebuild** — `rebuildSessionList` re-derives the item list and, in grouped modes, runs the lazy dir-resolution pass with its per-session tmux pane reads (the known ~0.5s By-Project cost at ~38 sessions).

**`applyCanvasMode` does not call `rebuildSessionList`.** Nothing heavy is on the theme-swap path, so no deferral mechanism is needed.

The premise that the re-render is the cost is also wrong: Bubble Tea rebuilds the whole view string on *every* keypress regardless, diffs it, and writes only changed cells — holding the down arrow in the sessions list already does this dozens of times a second. **A theme swap costs one ordinary keypress plus the style re-point.**

**"Bake in on exit" is rejected**: nothing is left un-baked, and deferring work to panel close would create a visible discontinuity at the one moment that should be seamless.

### 11.2 The real risk is completeness

Threading the theme (§3.4) fixes most of this: anything taking the theme as a parameter re-derives per frame. What remains is the **cached styles Portal does not own** — `bubbles/list`'s help styles, pagination dots, TitleBar, and both filter inputs — which are assigned once. That list is hand-maintained with no guard test, unlike the colour-literal rule which has an AST glob guard. Miss a site and the element silently keeps the previous theme's colours until something else re-renders it.

**Two known offenders are fixed outright**, not guarded around:

1. `pagepreview.go` copies a `Token` at **package init**, so it would never see a swap. The package-scope copy goes.
2. `canvasHexFor` references `theme.MV` directly — a hardcoded MV reference outside the token render path. It becomes theme-agnostic.

Fixing them does not make the guard redundant; **the guard is what stops them returning** (§13.4).

**The panel introduces a third `bubbles/list` instance, and it is the worst case of this class.** Its styles are assigned once at panel open, and it is the one surface whose theme changes on *every arrow keypress* (§9.11 requires the panel's own chrome to re-theme, no exceptions). Two rules keep it current:

- **The panel's delegate re-derives per frame from the previewed theme**, like every other delegate — so rows, badges, reasons and the cursor treatment are never cached.
- **The `bubbles/list`-owned styles the panel uses** (pagination dots, its own help/title styles) are re-pointed by **the same restyle path as the main list**, extended to cover the panel's instance. Not a rebuild — §11.1 rules that out as the expensive path, and it would be worse here, on a per-keypress surface.

**Coverage consequence for §13.4:** pagination dots only render when the panel's list paginates, so one of §13.3's panel fixtures must carry enough theme rows to overflow. Otherwise the guard is blind at exactly the new site this paragraph adds.

**These two are what was *found*, not the boundary of the class.** Init-time copies of *derived styles* (a style struct built from a token at package scope, rather than the token itself) were never swept for at all. Implementation must run that sweep rather than treating the two named fixes as closing the category. The swap-and-diff guard is the safety net that catches whatever the sweep misses — but a sweep that is never run leaves the guard doing work a five-minute grep would have done, and leaves the residue undocumented.

### 11.3 OSC 11 re-emission

- **No per-keystroke churn.** Bubble Tea v2 **diffs** the view's background colour and emits only on change, so hovering N themes emits OSC 11 exactly once per *distinct* canvas landed on — the minimum the feature requires. The declarative per-frame `BackgroundColor` assignment is not a per-frame write.
- **The echo guard needs no new race handling.** It exists because the startup OSC 11 *query reply* can race Portal's own canvas set. The query is issued once from `Init`; a later theme switch issues no new query, so it creates no new race. The guard only ever needs to compare against the canvas active during the *startup* window.

### 11.4 The exit-time canvas restore

`RestoreTerminalBackground` currently derives its comparison value *at exit* from `m.canvasMode` via `canvasHexFor`, which reads `theme.MV.Canvas` directly. Under a switchable theme that is wrong: it would compare against the *active* theme's canvas rather than the one in force during the startup window.

**Required change:**

- **Capture and retain the startup canvas hex as model state**, and anchor `RestoreTerminalBackground`'s comparison to it.
- **Make `canvasHexFor` theme-agnostic** — no `theme.MV` reference.

This is the mechanic carrying an explicit *"do **not** drop this guard"* warning, and the swap-and-diff guard structurally cannot cover it (it scans rendered fixture output, and this is an exit-time OSC 11 write). **It therefore needs its own named verification** — a direct unit test on `RestoreTerminalBackground`, driven without fixtures, asserting it compares against the retained startup canvas and not the active theme's, across both divergence cases:

- **A theme committed mid-session** — the persisted theme differs from the startup one.
- **Quit with an uncommitted preview active** — `Ctrl-C` with the panel open (§9.7). The model's active theme is the *previewed* one, which the user never persisted and which a naive implementation would compare against. This is the likelier mistake of the two, and the only path on which a colour the user never chose can be left stuck in their terminal after Portal exits.

The stakes are why: this is the one path where a mistake re-sticks a colour in the user's terminal **after Portal exits**.

## 12. Non-TUI surfaces, logging & docs

### 12.1 `portal theme export <slug>`

Writes the named theme to **stdout** in canonical form, so the full drop-in workflow is:

```
mkdir -p ~/.config/portal/themes
portal theme export nord > ~/.config/portal/themes/nord-lee.theme
```

The `mkdir -p` is part of the published workflow, not an omission: Portal deliberately never creates or seeds the themes directory (§5.5), and a shell redirect will not create it either — so without that line the first thing a new user meets is a redirect error. `docs/theming.md` carries the same two lines.

This closes a structural gap. *"Copy a built-in and edit it"* carries **two** decisions — it is the pro that justified `go:embed` (§7.1), and the deciding factor that rejected merge-over-a-base (§4.5, full replacement is only cheap if copying is cheap). But built-ins live inside the binary, `portal theme list` and `--theme` are ruled out, and an absent `themes/` directory is deliberately silent and never seeded — so without `export` the only route was finding the file on GitHub, which was never named as the workflow and is unavailable offline.

**Command surface:**

| | |
|---|---|
| **Bootstrap-exempt** | Added to `skipTmuxCheck`. Printing a file must not start a tmux server, ensure the saver, or run restore. |
| **Slug domain** | **Built-ins *and* drop-ins.** Resolving both makes export a diagnosis tool — "show me what Portal parsed" — not just an on-ramp. |
| **Invalid drop-in** | Refused, with its reason on **stderr** and a **non-zero exit**. Doctor's advisory-vs-health distinction (§12.2) is doctor's own contract and does not extend here. |
| **Unknown slug** | Same — reason on stderr, non-zero exit. |
| **Unreachable because the directory or file could not be read** | Refused with reason **`unreadable`**, not `unknown slug`. Export is the fourth by-name resolver and inherits §5.5's discrimination like the other three: `not found` sends the user to check the filename, `unreadable` sends them to check permissions. Without it, `portal theme export nord-lee` against a `themes/` directory the user cannot read prints *"no theme named nord-lee"* about a file that plainly exists — the same misdirection this table refuses one row above for a charset failure. It needs no new vocabulary: `unreadable` is one of §6.2's seven and §14A already pins its detail. |
| **Arguments** | Exactly one slug. Zero or more than one is a usage error (a Cobra `ExactArgs(1)` rule). |
| **Failure exit code** | **1 for every failure class.** Export is a pipe-into-a-file tool, not a diagnostic like doctor; the reason string on stderr is what discriminates, and distinguishing unknown-slug from invalid-file numerically buys nothing scriptable. |
| **A slug failing the charset check** | Refused with reason **`bad name`**, not `not found` — the same discrimination §9.4 draws for the panel, for the same reason: telling a user their file is missing when they typed an illegal name sends them looking in the wrong place. |
| **Verb group** | The `theme` group has only `export`. A one-member group, noted deliberately. |

**Output is the file's bytes, comments included** — not a re-serialisation of the parsed `Theme`.

The theme is still parsed and validated first (that is what refuses an invalid drop-in and an unknown slug), but what is written is the source file. Re-serialising would **drop every `#` comment**, and comments are not decoration here: they carry the attribution header the file format was chosen for (§4.1) and the eyeball-pin derivation notes that are the only surviving record of a non-numeric judgement (§7.1). A user running `portal theme export tokyo-night-day > …` to start a light theme would otherwise get a file stripped of exactly the notes explaining its pinned tints.

Byte-faithful output also makes the diagnosis framing honest — "show me the file Portal read" — and needs no separate decision on key ordering or trailing newline, since the shipped file already parses.

**This partially reverses the YAGNI ruling on theme CLI verbs, deliberately.** That ruling was about *listing* and *selecting* — both genuinely redundant with the panel. Export is redundant with nothing.

Considered and rejected: a panel key duplicating the highlighted theme into `themes/` as `<slug>-copy.theme`. Better placed (on-ramp at the point of intent) but it adds a key and makes the TUI write files; the verb is simpler, scriptable, and works when the panel is unavailable.

`docs/theming.md` additionally carries a complete copy-pasteable example theme for the no-terminal case.

### 12.2 `portal doctor` — a read-only theme health line

Doctor is Portal's established config-health surface, with full terminal width to enumerate per-file reasons on demand. It:

- **Scans the themes directory** and reports any file failing validity, with the reason and the specific token/line/key.
- **Reports when a persisted theme name no longer resolves.**
- **Reports an unreadable themes directory** (or a regular file where a directory belongs). An *absent* directory is silent (§5.5).

**Read-only, with no `--fix` action.** Doctor can prune a stale hook entry; it cannot repair someone's colours. Reading `prefs.json` to report an unresolvable theme goes through the **non-migrating** prefs read (§10.5), so running doctor never triggers the one-shot `appearance` translation — the read-only claim holds literally.

**Theme lines are advisory and do NOT drive the exit code — this amends doctor's contract.** Doctor's contract is a scriptable exit code, 0 iff all checks pass. Because there is deliberately no repair path, a failing theme line would go **permanently** non-zero until someone hand-edits a file — unlike every other check, which is either `--fix`-repairable or indicates genuine runtime breakage. The exit code exists as a signal about the **resurrection machinery** — daemon alive, hooks registered, state sane. A stray junk file in `themes/` is not that: Portal is working, it simply did not list one theme. Letting it hold the diagnostic red means an automated health check fires about the daemon because someone left a half-written palette lying around.

So doctor gains **two classes of line**:

| Class | Marker | Drives exit code |
|---|---|---|
| **Portal-health checks** | existing pass/fail markers | Yes, as today |
| **User-content diagnostics** | **`⚠`** — Portal's established warning glyph (MV §2.2, glyph-backed so it survives colourless) | **No** |

Theme validity is the first member of the second class. **Doctor's closing summary distinguishes the two counts** — e.g. *"N checks passed · 2 advisories"* — so the exit code's meaning is legible without reading the contract.

**One slug produces one advisory line**, mirroring §9.4's *"one slug is one row, always"* — the two surfaces render the same union and must not disagree about how many problems exist. When a persisted theme is *also* the invalid file (the most likely failure of all), the **unresolvable-persisted line wins**: it carries strictly more — the reason *and* which slot is affected — so the file-validity line would add nothing but a second entry in `<M>`. `<M>` counts lines, so it counts problems rather than detections.

**Advisories render as a trailing block, after the ordered check catalog and before the summary.** They do not interleave: the catalog is one line per check in a fixed order, whereas the theme class is 0..N lines whose cardinality depends on user content and which do not participate in `<N>`/`<T>`. Interleaving would make a fixed-order report vary in length and position with the contents of a directory.

**The theme scan runs on the `--fix` path too**, and its advisories and the `· <M> advisories` suffix appear there. `--fix` re-diagnoses after repairs and the theme lines are read-only in both passes — there is no repair to perform, and suppressing them would make `--fix` a *less* informative diagnosis than the plain run.

Rejected: failing the exit code on the grounds that a user who dropped a broken file into a Portal-read directory should get a loud persistent signal. They do — via the panel row and the doctor line — without conscripting a signal that means something else.

### 12.3 A new `theme` log component

Portal's log component taxonomy is **closed and spec-governed** — components are never invented at a call site. **This feature adds a `theme` component via spec amendment**, with direct precedent: `spawn` and `resolve` were both added by the features that needed them.

What distinguishes it from `prefs` and `terminals` (both deliberately outside the vocabulary) is that those are **dumb stores with no runtime behaviour**, whereas the theme loader has parse/validate/fallback *outcomes*.

**Event catalogue:**

| Event | Level | Cadence |
|---|---|---|
| `theme: loaded` | INFO | At TUI construction, **one line per nominated theme** — one under a constant, two under an adaptive pair — each carrying `slug` and, for the pair, `slot`. Resolved slug(s) only; **no count** (nothing is enumerated at construction). One line per nomination rather than one combined line keeps `slug`/`slot` single-valued, which is what makes the log greppable per theme. **Also fires at commit time** for the one load that happens outside construction: the newly-live opposite slot on a constant → adaptive conversion (§8.4). **When a nomination is unloadable it fires for the fallback too**, carrying the fallback's slug — otherwise `theme: fallback applied` and `theme: loaded` both name the slug that *failed*, and a `grep "theme:"` on a broken install cannot answer which palette is actually rendering. That is the greppability the component is justified on (§6.3). |
| `theme: enumerated` | INFO | At panel open, **every open** (it is a per-event INFO, not a repeated warning, so it needs no dedup). `count` is **rows produced** — the full §9.4 union, built-ins included — and `rejected` is **unselectable rows**, which is the subset carrying a §6.2 reason. Both are stated because the union makes them genuinely ambiguous: "files considered" and "valid themes" would give different numbers on the same install. Fires on an **absent** directory too (`count` reflects the built-ins) and on an **unusable** one (`count` likewise, alongside `theme: directory unusable`) — the panel opened either way, which is what the event records. |
| `theme: rejected` | WARN | One per rejected file, **deduplicated per process** — a given slug+reason logs once, so five panel opens (enumeration re-reads on every open, §5.8) do not produce five identical WARN sets. Carries `token` where the reason names one (`missing tokens`, `bad colour`) — this is the `token` attr's only consumer. A file with **no slug** (`bad name`) is identified by `path` instead, and the **dedup key is `slug`+`reason` where a slug exists and `path`+`reason` where it does not** — otherwise the class most likely to recur across panel opens is the one class with no dedup key. |
| `theme: directory unusable` | WARN | Where the themes directory is unreadable, or a regular file sits where a directory belongs (§5.5). Carries `path` and `reason`. **Deduplicated per process on `path`+`reason`**, like its neighbour — enumeration runs on every panel open (§5.8), so without it a user with a bad directory gets an identical WARN per open. An *absent* directory emits nothing. |
| `theme: fallback applied` | WARN | Carries `slug` (the nomination that failed), `slot` where one applies, and `reason` — without them the line is not greppable, which is the whole reason the log earns its place. **Deduplicated per process on `slug`+`reason`**, like its neighbours. A persistently broken active theme resolves a fallback at construction (§8.4), again on every panel open (§9.2) and again on every `Esc` (§5.8); "per fallback" read literally would make a passive forensic trail into a running commentary. |
| `theme: appearance migrated` | INFO | Emitted on **successful persist**, not on compute. §10.5's write is best-effort and retries next launch, so a compute-time emission could legitimately fire on several consecutive launches and "one-shot" would be false. Tied to the persist, it fires exactly once — and its absence after a translation is itself the signal that the write failed. |
| `theme: commit failed` | WARN | Per failed write. Carries `slug`, `slot` (absent when committing a constant), and `reason`. |

**Attr keys:** `slug`, `slot`, `reason`, `path`, `token`, `count`, `rejected`.

**Emission is controlled by an injected logger, not by the loader deciding.** The loader takes a logger seam; `cmd` passes a **real** component logger on the paths where a theme is used — TUI construction, the panel, the theme persister — and **`log.Discard`** on `portal doctor`, `portal theme export` and `capturetool`. The tool is a fifth caller and neither uses nor diagnoses a theme — it is an offline renderer whose output is a frame, so emission would be noise, and `Discard` also leaves its per-process dedup state owned rather than dangling. That is the mechanism §3.2's "the loader binds the `theme` component" describes: it holds the binding and the call sites, while the caller decides whether anything is written. Without it the loader either emits for everyone (doctor writing a full WARN set on every run) or for no one (leaving `loaded`, `enumerated`, `rejected`, `directory unusable` and `fallback applied` with no site at all, unlike `commit failed` and `appearance migrated`, whose sites §8.9 and §10.5 pin).

**The per-process dedup state lives on that injected logger**, so it is shared by every path in a TUI process — which is what §5.5 requires when the construction-time by-name read and the panel's enumeration hit the same condition. It is not package state in the leaf, which §3.4 avoids for the same reason everywhere else, and a test controls it by injecting a fresh one.

**The component records where a theme is *used*, never where one is *diagnosed*.** `portal doctor` and `portal theme export` both enumerate or parse and both can hit every §6.2 reason — and **neither emits any `theme` event**. Three reasons, and they compound:

- The log's stated job (below) is to be the record that exists **without the user going looking**. Doctor and export are the user looking; their whole output is already the diagnostic, printed to the screen the user is reading.
- Doctor is the run most likely to hit a full reject set, so emitting would put the largest WARN volume on the surface that needs it least.
- It keeps doctor's read-only claim literal, which §10.5 and §12.2 already went to some trouble to preserve — a diagnosis command that writes WARNs about a state it just reported is the same shape of side effect.

This also makes `theme: rejected`'s per-process deduplication determinate: the emitting processes are TUI launches, and nothing else.

Both additions close holes in the closed declaration rather than extending it by preference: `rejected` was already used by `theme: enumerated` without being declared, and §5.5's required log entry for an unusable directory had no event that fits (`theme: rejected` is per-*file*, and §6.2's `unreadable` reason is defined as "the file could not be read").

Rejections are **WARN**, not INFO: doctor treats them as advisory for *exit-code* purposes, but "your config did not work" is a warning in a log.

**Why the log earns its place:** a TUI launch that rejects a theme should leave a **passive** record. The panel's row is only visible if the panel is opened; doctor must be invoked. The log is the only trail that exists without the user going looking.

**The exec path is not a surfacing route.** The exec path (`portal open <target>`) constructs no TUI, so under lazy discovery the loader **never runs there** — nothing themed is rendered and there is no failure to surface or record on that path at all. Both the doctor line and the log component earn their places on other grounds (above). **And a win worth recording explicitly: on the path Portal is most careful to keep free of cost, this feature adds nothing at all.**

### 12.4 `docs/theming.md`

A new user-facing doc, following the `docs/custom-terminals.md` precedent (a user-authored config file with its own doc).

**Contents:**

- **The 19-token vocabulary with each role's meaning** — the substance of §2.5. `docs/theming.md` is **the source of truth for the public contract.**
- **The text ramp's weight ordering** — the sole record of it, since file ordering carries nothing (§2.7).
- **The file format** — lexical rules, value domain, the closed key set.
- **Discovery: where a theme file goes, what it must be called, and how Portal finds it.** The drop-in author's first three questions, and currently the only part of the contract with no documented home:
  - The themes directory and its resolution chain — **`PORTAL_THEMES_DIR` → `XDG_CONFIG_HOME/portal/themes/` → `~/.config/portal/themes/`** (§5.5). §5.5 fixes that env var's name in the spec *precisely so this doc can print it*.
  - The filename rules — the filename is the identity, the slug charset `^[a-z0-9][a-z0-9-]*$`, and the exactly-lowercase `.theme` extension (§5.1–§5.3). Violating them produces `bad name`, which the panel and doctor both render, so the rules belong where a user reads before writing the file rather than after.
  - The enumeration rules that decide whether a file is seen at all — top-level only, symlinked files followed, symlinked directories skipped (§5.6).
  - **The two-line drop-in workflow** from §12.1, `mkdir -p` included — Portal never creates or seeds the directory, so without that line the first thing a new user meets is a redirect error.
- **A complete copy-pasteable example theme** (also the no-terminal on-ramp).
- **The two-slot config** — `theme` / `theme_light` / `theme_dark`, constant vs adaptive, mutual exclusion, the `theme`-wins hand-edit rule.
- **The reserved built-in slugs.**
- **Attribution for ported palettes** — source and link, plus the Nord corrections. Attribution lives in the repo and README, **explicitly not in the UI** (no credits screen, nothing in the slide-over).

**Attribution and licensing are deliberately not pursued further.** No per-theme licence line, no "(adapted)" naming convention, no PR contribution requirement. Ported palettes keep their own names.

**`docs/theming.md` gets a guard** (§13.5) — it is now the sole record of the ramp ordering and role meanings, with nothing otherwise keeping it honest. The guard covers the **vocabulary half only**: it parses the token table and compares the name set against `Theme.All()`. The discovery half above has no automated check and is maintained by hand.

### 12.5 README and CHANGELOG

`appearance` is described in `README.md` at **four places**, and all four come out with the setting:

| Site | Change |
|---|---|
| The paragraph recommending users pin it *"when auto-detection misfires (for example under tmux passthrough)"* | **Deleted.** Obsolete twice over — the premise was probably never true in the first place (§8.7). |
| The feature bullet — *"auto-detected, or pinned via `appearance`"* | Rewritten to the theme setting: detection follows the terminal background, pinned by a constant `theme`. |
| The TUI-views paragraph — *"set `appearance` in `prefs.json`"* | Same rewrite. |
| The config-file table row for `prefs.json` | Now lists `theme` / `theme_light` / `theme_dark` alongside the grouping mode. The table also gains a **themes directory** row carrying `PORTAL_THEMES_DIR` — §5.5 fixed that name precisely so the docs could print it. |

README gains the theme setting in their place, pointing at `docs/theming.md`.

**The retained `appearance` key is not documented as live.** §10.4 keeps it on disk as a frozen legacy value for downgrade, not as a setting to advertise — documenting it would invite users to set it in a binary that no longer reads it.

**CHANGELOG.** This release needs a user-visible upgrade note, not just a feature line — two other decisions lean on the user knowing the setting changed shape. §10.4 keeps `appearance` on disk precisely because Homebrew downgrades are routine, and §9.9 accepts "no unset" on the grounds that `prefs.json` is hand-editable *and documented*. The entry must therefore cover:

- The new theme setting (`theme` / `theme_light` / `theme_dark`) and the three built-ins, pointing at `docs/theming.md`.
- That **`appearance` is replaced and translated automatically** — a pinned `light`/`dark` becomes the equivalent constant theme, `auto` needs nothing — so a user who set it does not have to act.
- That the old key is **left in place** for downgrade, and is not kept in sync afterwards.

### 12.6 `CLAUDE.md`

`CLAUDE.md` is what an implementing agent reads first, and seven of its entries describe the pre-feature world. All seven are corrected by this feature — leaving them stale would have most of them actively misdescribing the subsystem under construction while the work is under way.

| Entry | Correction |
|---|---|
| **The `tui/theme` row** | Describes ~20 tokens "each with a **Light and Dark** variant", `Token.ColorFor(mode)`, `theme.MV` as the single built-in, `Mode`'s zero value as the no-answer fallback, and `contrast_test.go` measuring against two hardcoded canvases. Every clause is deleted by §2.1, §3.2 and §13.5 — and the row itself **moves**, since §3.2 relocates the package to a new `internal/theme` leaf. It leaves the TUI's subtree in the internal-packages inventory and the leaf is a new member of it. |
| **The `tui` row** | Describes `restore.go` painting "the **mode-matched** canvas" and the canvas-echo guard comparing "against the canvas hex", carrying the standing *"do not drop this guard"* warning. §11.4 re-anchors that comparison to a retained **startup** canvas hex and makes `canvasHexFor` theme-agnostic; §3.2 deletes the mode concept the wording rests on. **This is the entry whose staleness is most dangerous** — it is the warning an implementer reads immediately before touching the exact code §11.4 changes. |
| **The "Config path resolution" section** | Enumerates the config surface as resolving via `configFilePath`, and describes the TUI wiring as `WithInitialMode` / `WithModePersister` / `WithAppearance`. §3.2 adds `themesDirPath` (a *directory*, not a `configFilePath` member), §5.5 adds `PORTAL_THEMES_DIR`, §10.5 adds the non-migrating read variant, §8.9 adds `WithThemePersister`, and §8.8/§8.4/§13.3 delete `WithAppearance` in favour of the loaded nomination. |
| **The "Server bootstrap" section's bootstrap-exempt set** | Lists `skipTmuxCheck` verbatim. §12.1 adds `theme`. |
| **The `prefs` row** | Documents the `appearance` override, the `Appearance` enum and its tolerant decode, and `cmd/open.go`'s `WithAppearance` wiring. Replaced by `theme` / `theme_light` / `theme_dark` / `theme_migrated` per §8.1 and §8.8 — noting that `appearance` survives on disk as a preserved raw string (§8.8). |
| **The logging section** | Pins the taxonomy at "17 component names". §12.3 adds an 18th (`theme`) with its own attr keys — the same shape of amendment `spawn` and `resolve` carried, which is why the count is stated at all. |
| **The visual capture harness section** | Describes `testdata/vhs/` as committed reference PNGs forming a visual-verification harness, which reads as a durable asset. It is not (§13.2). The `capturetool` flag description also changes with §13.3. |

## 13. Capture harness & test strategy

### 13.1 Why `capturetool` is load-bearing

**Portal cannot be run from a temporary build to check a visual change.** A scratch build interferes with the live system — it disturbs the running daemon, its bootstrap sequence touches real state, and sandboxing does not fully contain it.

So `capturetool` is not a convenience; it is the **only viable route** to seeing a visual change before release. This also endorses the fixtures' deliberate shallowness: they do just enough to visualise what is meant to be visualised. **Fixtures are about look, not behaviour** — they need not be functionally complete.

**Two mechanisms, two audiences — both stay:**

| Mechanism | Audience | Why |
|---|---|---|
| **A producible PNG per fixture**, via VHS (§13.3) | The **agent** | During the agentic implementation loop the implementer captures a screen, looks at it, and assesses its own work; the reviewer does the same. **Without a producible PNG the agent cannot see what it built**, and every task ends up hand-corrected — the exact failure mode this tooling exists to prevent. |
| **`capturetool --fixture`** | **The human** | Loaded in a real terminal at the human-in-the-loop gate and judged as the real thing — Portal's look and feel, without running Portal. |

**The workflow this serves:** implement → capture → agent self-assesses → reviewer → converge → *then* the human gate.

### 13.2 Committed reference PNGs were scaffolding, not an asset

The committed reference PNGs were never meant to persist — they existed so the redesign could be watched coming to life during implementation. **There is no visual-regression obligation**, so there is no themes × fixtures matrix problem: three built-ins do not multiply 43 committed images into 129.

**Retention rule, drawn now:**

- **Everything that exists today as an image or tape is deleted** — the committed reference PNGs and the VHS tapes that produce them. They could not survive the token rename and the theme split without a full recapture in any case.
- **From this feature forward, captures and the tapes that produce them are created as work proceeds, committed while they are being collaborated on, and cleared out after sign-off** so they do not live in the repository forever. A tape is scaffolding on the same terms as the image it renders.
- **This feature does not take on a general repo-wide capture cleanup**, and does not clear captures continuously as it goes. Both of the above are in scope and both are single, bounded acts: delete today's images and tapes once at the start, clear this feature's own once at sign-off.

**The deletion covers images and tapes, NOT fixtures.** The Go fixture *definitions* in `internal/capture` and the harness itself are **permanent** — the swap-and-diff guard drives the fixture renderer and its coverage assertion needs the fixture set to exist. "Cleared out after sign-off" likewise means the images, not the fixtures.

### 13.3 Harness changes required

- **`capturetool` and `internal/capture` survive and are open for edit.** Whatever the tool needs to work with the new system is in scope for this feature — no separate redevelopment work unit.
- **`tui.Build` takes the loaded *nomination* where it takes a `prefs.Appearance` today** — the exact injection mechanism this work removes, replaced per §8.4 (one theme under a constant, both under an adaptive pair — with the active member selected by the gate, not supplied by the caller). `capturetool` always passes the **constant shape**: a single pinned theme, no gate, no wait — which is what keeps captures byte-deterministic. Without this injection the harness can only ever render the compiled-in default.
- **`capturetool` gains a `--theme` flag, replacing `--appearance`.** `--theme` accepts a built-in slug **and an explicit path to a real theme file**. An explicit path from a flag is an **input, not config discovery**, so the `internal/capture` no-real-config import guard's invariant is preserved (no XDG lookup, no prefs read). This matters disproportionately: it is the only visual-verification route for someone authoring a drop-in.
  - **Default: `tokyo-night`** when the flag is omitted, matching the shipped dark default. Every capture taken without the flag depends on it.
  - **Slug versus path is discriminated by a path separator *or* the `.theme` suffix** — so `nord` is a slug, and `nord.theme`, `./nord.theme`, `/abs/nord.theme` and `./mytheme.txt` are all paths. The separator half matters: without it a real file with an unexpected extension would be classified as a slug and rejected as an unknown built-in, an error naming the wrong problem for a file that plainly exists.
  - **Only the content reasons apply to a path** — `bad syntax`, `bad colour`, `missing tokens`, `unreadable`. **Invalid input is a hard error** with the §6.2 reason and a non-zero exit, never a fallback: silently rendering the wrong theme at a visual gate is precisely the failure this tool exists to prevent. An explicit path may carry any extension, because **no slug is derived from it for identity** (§3.2) — the rendered theme has none.
  - **A candidate slug *is* derived from the basename, solely to produce the warnings below**, and never used as identity. Without that derivation the `reserved name` warning cannot exist, since §6.2 decides both filename reasons from the slug alone.
  - **The filename reasons — `bad name` and `reserved name` — warn on stderr but do not block, and apply to the path form only.** A slug argument (`--theme nord`) names a built-in by design, so checking it for `reserved name` would warn on the normal documented invocation. Blocking would break the workflow §12.1 publishes, since an exported built-in is a reserved slug until the user renames it. Warning is what the flag's stated purpose demands: it is the only visual-verification route for someone authoring a drop-in, so it is the one place a fatal filename is worth catching before the file reaches the themes directory.
- **`--appearance` is removed, not kept alongside.** It exists today (`dark|light`, resolving to a pinned `prefs.Appearance`), and its entire backing mechanism — `prefs.Appearance` and `WithAppearance` — is deleted by §8.8. There is no mode left to pin; a theme *is* the mode.
- **The contrast-validation swatch fixture is re-pointed to `--theme` too.** `capturetool` carries a standalone labelled-tint swatch branch (the MV spec §16.5 lock-in/bail surface) which deliberately does not route through `tui.Build` and is driven by `--appearance` today. It is the surface that satisfies the human eyeball gate §7.5 and §13.5 require for a new light theme's pinned tints, so it must take a theme like everything else.
- **PNG production stays on VHS. No direct writer, no new dependency.** The hard requirement is that **every fixture can produce a PNG** (§13.1) — that is what the mechanism must satisfy, and VHS already satisfies it. Rasterising styled ANSI needs a terminal-cell renderer with an embedded font and fixed cell metrics, which would mean a real module dependency plus a font asset in a repo that has deliberately avoided both, to replace a mechanism that works.

  §13.2 deletes the *current* tapes along with the images, because both are scaffolding tied to the pre-rename, pre-split screens. **New tapes are written per fixture as work proceeds and cleared out after sign-off**, under exactly the same retention rule as the images (§13.2) — a tape is scaffolding, not an asset. VHS also remains the route if a gif is ever wanted for motion.

- **The harness is known to fail silently on write, and this feature is unusually exposed to it.** VHS runs the tape, reports no error, and does not produce the PNG — so the agent pixel-checks a **stale or absent** image, which reads either as "the change didn't render" or, worse, as a false pass against the previous capture. A theme change is visible *only* in the image; there is no functional assertion that would catch a capture that never landed, and every capture in this feature is a first-time write through a freshly-written tape.

  **Mitigation, procedural and mandatory: verify a fresh write before trusting or reviewing a capture** — confirm the file's hash changed — and retry on failure. This qualifies the chosen mechanism rather than reopening it: VHS satisfies the requirement, and §13.1's argument is that the agent cannot see its work without it, which makes an unverified capture worse than none.
- **The panel's theme enumeration is behind an injectable seam.** A `ThemeEnumerator`-shaped interface, matching the `TmuxEnumerator` / `ScrollbackReader` idiom the preview page already uses: production wires the real implementation, fixtures fake it.

  **The seam returns the finished §9.4 union, not a directory listing.** It takes the raw persisted theme keys and returns the complete row set — every `.theme` file, every built-in, and every persisted slug resolving to neither — already deduped one-slug-one-row and already carrying each row's reason. **`internal/theme` owns that assembly**, which is what keeps three other decisions consistent: `theme: enumerated`'s `count` and `rejected` are computable where they are emitted (§12.3), `internal/tui` does not become a fourth package emitting the `theme` component (§8.9 closes that set at three), and the panel does no merging of its own.

  A fixture still declares raw persisted keys separately (below) because **badges read them directly** (§8.4) — the union is what the panel *lists*, the keys are what it *marks*.

  §9.2's post-commit re-derivation calls the same assembly with changed prefs state and no fresh directory read, which is why it is one entry point rather than logic inlined in the panel. This is an architectural requirement, not a convenience — the harness must render an invalid-theme row without a real themes directory, and §7.1's no-real-config import guard forbids `internal/capture` reaching config at all. It is also what makes the panel unit-testable (row composition, ordering, truncation, the invalid-row skip), none of which otherwise has a test home.
- **New fixtures are added for the slide-over**, so every specified panel surface is visible during implementation rather than at release — which matters because §13.1 makes the harness the only route to seeing any of it:
  - **The adaptive-pair state** (two slot badges).
  - **The constant-while-previewing state** (a bare `●` while the cursor sits elsewhere).
  - **An invalid-theme row**, and **the pinned `⚠ dir unreadable` row** — the latter has its own placement rule, token and pinned copy, and no other way to be checked.
  - **The message slot in both states** — the confirm and the failed-commit line. §9.1 warns these may wrap at the minimum width and §14A calls panel wording a layout constraint, so the one copy the spec says might not fit must be capturable.
  - **The narrow degraded panel**, and **the panel at its minimum height with a message live** — §9.8's floor is defined as header + footer + one row + one message row, and that arithmetic is only observable on a frame that renders it.
  - **A panel long enough to paginate** (§11.2), so the pagination dots are covered by §13.4's guard.
  - **The panel over the Projects page** — `t` is bound there (§9.6), Projects carries its own flash slot (§14A), and every other panel fixture is implicitly Sessions-based.

  A missing fixture is a blind spot the guard structurally cannot report: §13.4 enumerates whatever fixtures exist, so absence reads as coverage.

- **A fixture declares its own raw persisted theme keys, independently of `--theme`.** The two inputs are separate by §8.4's own construction: `--theme` pins the *palette* the nomination carries, while the badges, the `not found` and charset-rejected rows, and the persisted-slug-under-fallback case all derive from the **raw keys**. Without that separation the adaptive-pair fixture is unreachable — `capturetool` always passes the constant shape, and §8.2 makes a non-empty `theme` render a bare `●` with no slot badges, so a fixture built from the nomination alone could only ever produce the one state.

  **A panel fixture has four inputs:** the `--theme` palette, the raw persisted theme keys, the faked `ThemeEnumerator`'s row set, and **the cursor position**. The fourth is required and was previously unstated: §9.2 puts the cursor on the active theme at open, so a fixture that cannot declare it cannot render the mandated *constant-while-previewing* frame at all — that frame's whole point is a cursor on a row other than the marked one, which is otherwise reachable only by arrowing, and fixtures are one-shot renders.

  **The coherence rule, stated generally: `--theme` must name the theme under the cursor.** §9.2's invariant is that the cursor's row is always what is painted behind the panel, so the palette follows the cursor, not the persisted setting. For the adaptive-pair fixture at open that resolves to the dark slot's theme (`capturetool` runs no gate, so the standing no-answer fallback selects dark); for the constant-while-previewing fixture it is the *previewed* theme, which is deliberately **not** the marked constant. This is an authoring rule the harness cannot check: an incoherent frame is indistinguishable from a correct one to a reviewer, and §13.4's guard enumerates fixtures and diffs colours, so it passes too.

  This is fixture data, not config discovery, so §7.1's import guard is untouched — the same reasoning that lets `--theme <path>` take an explicit input. It is load-bearing because §13.1 makes the harness the only route to seeing any of this before release, and §9.14 identifies the slot half as the part with no prior art anywhere: the badges are precisely what the visual gate exists to judge.

### 13.4 The swap-and-diff completeness guard

**What it is:** render **every fixture** under theme A, switch to theme B, render again, and scan the second output for any colour value belonging to theme A.

**The guard enumerates the harness's fixture set; it never names fixtures.** This is the mechanism the guard's claims rest on, not an implementation nicety. The offline harness already renders every canonical screen deterministically through the shared `tui.Build` constructor with every tmux seam faked, so **the fixture list *is* the coverage list, and it grows automatically as screens are added**. A test that names four or five fixtures satisfies all three assertions below today and keeps passing tomorrow, while the next screen anyone adds goes silently uncovered — which is precisely the "including ones added years later" immunity claimed below, and the reason the guard exists at all is that the missed sites cannot be found by reading code. It is also what puts §13.3's four new panel fixtures and §11.2's paginating panel fixture under the guard without anyone remembering to add them, and what makes §13.2's argument for keeping the fixture *set* alive coherent. A survivor means some element never got the new theme — the "assert no stale data survived the invalidation" trick applied to rendered output rather than a cache. It exists because the cached styles `bubbles/list` holds cannot reliably be found by reading code (§11.2).

This is a **behavioural** guard, not a structural one, deliberately. It catches *any* missed site — including ones added years later — without anyone having to remember a rule. A structural guard would have to recognise "this is a cached style" in the AST, which is not mechanically well-defined.

**It uses two synthetic themes constructed inside the test, all 38 values deliberately unique** — none repeated within a theme or across the pair. Using two shipped themes has two failure modes, and both are a matter of time:

- A hex both palettes happen to set identically survives the swap *legitimately*, so the test fails permanently for a non-bug.
- Worse and silent: a token with the *same* value in both themes renders identically before and after, so the test cannot tell whether that site updated — it passes either way and the site is uncovered with no signal.

Synthetic themes make coincidence impossible, cover every token site genuinely, and mean nothing done to the shipped palettes can break or blind the guard.

**Three assertions:**

1. **No theme-A value survives** in the post-swap output.
2. **Every expected theme-B value is present** — catching a site that renders *nothing* rather than merely stale. This is a **union across fixtures**, not per fixture: no single screen renders all 19 roles.
3. **Every token is exercised by at least one fixture.** The union in (2) is only complete if every token appears on *some* fixture, and the at-risk ones are the transient states (`bg.attention` / `text.on-attention`, `accent.mode`, `state.destructive`, `text.on-selection`). Making this an assertion of the guard means a token with no fixture **fails the test** and someone adds a fixture, rather than the guard being silently blind at precisely the sites it exists to protect.

**The swap must be a live mutation of one already-rendered model, through the production swap path.** This is the guard's whole point and the easiest way to build it wrong: the caches it exists to catch are assigned *once at construction*, so a test that builds two models — one per theme — assigns every cached style correctly in each and **passes green while live swap is broken**. The fixture harness builds a fresh model per fixture today, which is exactly the shape that would produce that vacuous pass. Specifically:

- **Render under A first, then swap, then render again.** The A-render is not optional set-up — it is what populates the caches. A fixture rendered only after the swap passes trivially.
- **The swap goes through the same entry point the panel's arrow-preview uses** (the `applyCanvasMode` restyle and style re-point), not a test-only setter and not a rebuild.
- **`internal/capture` / `tui.Build` must expose a seam to drive that from a test**, since fixtures are one-shot renders today. Adding it is in scope (§13.3).
- **The render is forced to a truecolor profile.** Under `go test` stdout is not a TTY, so lipgloss would otherwise strip colour and there would be nothing to diff at all.
- **The comparison is against each token's *rendered* form, not its hex.** Styled output carries no hex — a truecolor foreground is `ESC[38;2;R;G;B m`, decimal — so the guard converts each theme's token values to their SGR representation and searches for those. Stating it matters because assertion 1 is a **negative**: searching for the wrong representation passes vacuously and silently. Assertion 2 is the backstop that would fail loudly, which bounds the exposure, but the guard is the feature's central completeness mechanism and should not rest on a backstop.

**Lane: unit.** It renders only through the offline harness — no tmux server, no daemon, no built binary.

**Colourless fixtures are excluded.** A colourless render contains no theme hexes, so there is nothing to diff — inclusion would be meaningless rather than merely redundant.

**The two known offenders (§11.2) stay fixed *and* guarded.** Fixing `pagepreview.go`'s package-init `Token` copy does not make the guard redundant; the guard is what stops it returning.

**Not covered by this guard, needing its own test:** the exit-time canvas restore (§11.4). The guard scans *rendered fixture output*, so it structurally cannot cover an OSC 11 write that happens after the last render.

### 13.5 Contrast checking

**Floor-check enrolment is automatic.** The floor tests **auto-enumerate the embedded set**, so a new built-in is checked by default. "The floor test" is ten tests, all rewritten by this feature — see §13.6, which names them; the enrolment assertion below composes with all ten.

**The canonical rule set, stated here because "auto-enumerates" only means anything against a complete and theme-independent list.** §7.4's table is the *Nord port's* verification record — a walk of these rules for one palette — not the rules themselves. Every ratio is measured against **the theme's own `canvas`** (§13.5's amendment), never a constant. Three floors carry the whole set: **4.50** normal text, **3.00** large/UI, **1.10** fill-perceptible.

*Foreground vs canvas:*

| Token | Rule |
|---|---|
| `text.primary`, `text.secondary`, `text.tertiary`, `text.muted` | ≥ 4.50 |
| `text.subtle` | band **3.00–4.49** — it must clear the UI floor *and* stay below normal text, or it is not de-emphasised. (This generalises what ships today as a light-only ceiling; the Nord port already satisfies it at 3.18.) |
| `text.faint` | band **> 1.00 and < 3.00** — visible but decorative-only; reaching the UI floor is a failure |
| `accent.primary` | ≥ 3.00 (large/UI — it renders bars and glyphs, not body text) |
| `accent.key`, `accent.mode`, `accent.attention`, `state.positive`, `state.destructive` | ≥ 4.50 |
| `border`, `canvas` | no numeric floor |

*Tint pair rules — three legs each:*

| Tint | Legs |
|---|---|
| `bg.selection` | text-on-tint (`text.on-selection`) ≥ 4.50 · bar (`accent.primary`) vs canvas ≥ 3.00 · fill vs canvas ≥ 1.10 |
| `bg.attention` | text-on-tint (`text.on-attention`) ≥ 4.50 · bar (`accent.attention`) vs canvas ≥ 3.00 · fill vs canvas ≥ 1.10 |
| `bg.subtle` | fill vs canvas ≥ 1.10 only — nothing renders on it |

*Foreground-on-tint pairings, all ≥ 4.50:* `text.on-selection`, `text.secondary`, `text.tertiary` and `state.positive` on `bg.selection`; `text.on-attention` on `bg.attention`.

*Single-token dual clearance:* `state.positive` is one token rendering both on the canvas and on the selected row, so it must clear **both** — ≥ 4.50 against canvas *and* against `bg.selection`. This is the leg that caught the Nord green (§7.4) and the one MV itself solved by darkening.

*Light themes only:* the four eyeball-pinned tints carry **additional** exact-value pins. **Nothing above is relaxed** — every rule in this section applies to every bundled theme regardless of light or dark, including the ≥ 1.10 fill legs on all three tints. The light/dark table's sole job is **enrolment**: it names which built-ins are light so `TestLightSurfaceTintsPinned` and `TestLightTintFillsArePerceptible` know which themes to run against. "Carve-out" describes the *enrolment*, not a relaxation.

`border` is one of the four pinned tokens but carries no numeric floor in the table above, so it participates in the pins and in nothing else (the count of four is load-bearing — §7.1 decides which pin notes move into the theme files by it).

**Plus a light/dark table**, needed because the light surface tints are not numerically checkable (light-tint-on-light-canvas is numeric-insufficient — hence `TestLightSurfaceTintsPinned`), so the carve-out must apply to light themes only.

**The eyeball-pinned set is four tokens, not three.** `TestLightSurfaceTintsPinned` today pins five entries — `bg.selection`, `bg.warning`, `bg.track`, `border.separator`, `border.footer` — which is **four distinct tokens after the §2.2 border consolidation**: `bg.selection`, `bg.attention`, `bg.subtle`, `border`. Each carries a matching `pinned — derivation … eyeball-confirmed` comment in `theme.go`, and `TestLightTintFillsArePerceptible` covers the same set. The count is load-bearing: it determines which pin notes move into the theme files as `#` comments (§7.1), and how wide the light-only carve-out has to be. **All four.**

- **It is the *test* that needs to know, not the product.** A test table is allowed to know things the runtime does not — the vocabulary stays variant-free (§4.7) and the table names which built-ins are light.
- **The table carries an assertion that every embedded theme appears in it.** A forgotten entry fails the suite rather than silently shipping a Portal-endorsed theme nobody checked — or measuring a light theme against a dark reference.

**`contrast_test.go` resolves its reference background from the theme.** It currently measures against two hardcoded canvases; under split each theme carries its own `canvas` token, so the reference comes from the theme rather than from a constant.

**`docs/theming.md` gets a guard.** It is now the sole record of the ramp's weight ordering and the 19 roles' meanings, with nothing keeping it honest — and this feature found the MV spec's "2-tone border" claim stale against the implementation purely by chance. Same drift class, same subsystem. **A test parses the doc's token table and compares the name set against `Theme.All()`** — cheap, and matching the codebase's existing guard idiom. The doc's copy-pasteable example theme is covered by the same guard: it must parse and contain all 19 keys, so it is not a fourth unguarded copy of the vocabulary.

### 13.6 Guard-test reshape

| Test | Change |
|---|---|
| **`TestMVTokenCount`** | Moves 20 → 19, and its meaning shifts from "MV has 20 tokens" to "**the vocabulary is 19**". |
| **`TestMVDarkVariantsPinned`** | **Deleted.** Once themes are data files whose values are their own source of truth, an exact-hex pin in a Go test is a change-detector duplicating the file. The contrast floor test is the real guard for bundled themes. |
| **`TestLightSurfaceTintsPinned`** | **Survives, and becomes per-light-theme.** The four light surface tints (§13.5) are not numerically checkable, so for those the exact-value pin is the only guard. They keep their pin, and the *why* moves into the theme file as a `#` comment — which the flat format supports. **The format decision is what makes deleting the Go-side erratum comments safe rather than lossy.** Pins for any new light theme are established by human eyeball at a visual gate. |
| **`TestEachTokenCarriesLightVariant`** (`theme_test.go`) | **Deleted.** It asserts the `ColorFor(Light) ≠ ColorFor(Dark)` resolver seam, which cannot compile once `Token` is `{Name, Value}` and `ColorFor` is gone. |
| **`TestEveryTokenHasLightVariant`** (`contrast_test.go`) | **Deleted.** Same fate — it asserts every token carries a populated, parseable `Light` hex. Its *parseability* half is subsumed by the embedded-set validity test (§7.6), which checks every value in every shipped theme. |
| **`TestLightTintFillsArePerceptible`** | **Survives, and becomes per-light-theme**, alongside `TestLightSurfaceTintsPinned`. It covers the same four tints and takes the same light/dark table membership (§13.5); its ≥1.1 fill floor resolves its reference background from the theme rather than the hardcoded light canvas. |
| **Loader / parser test** | **New.** The single most branch-heavy component in the feature has no other test home — §7.6's embedded-set test only ever sees valid files by construction. It is table-driven over §4.2's branch table, §4.3's hex domain, §5.2's slug charset, §5.4's reserved-name check, and — critically — **§6.2's fixed-order short-circuit ladder**, which is only meaningful if pinned: a file that is simultaneously duplicate-keyed and missing tokens must report `bad syntax`, and nothing else asserts that. |
| **Prefs + migration test** | **New.** This is the one part of the feature whose failure mode is silent, permanent destruction of a user's config, and none of it is observable at the moment it goes wrong. It covers §10.2's mapping; §10.3's separation of trigger from no-op condition, including the reachable loss-of-setting sequence it exists to close; §8.1's marker rules (written only when the file exists, empty values omitted); §8.8's raw `appearance` round-trip — whose named failure is that the first `s`-keypress after upgrade silently erases the user's pin, invisible until a downgrade; and §8.9's RMW merge, that writer A does not revert writer B's field. The spec pins a named test for `RestoreTerminalBackground` because it can leave a colour stuck in a terminal; this path deletes a setting the user chose. |
| **The ten floor tests in `contrast_test.go`** — `TestForegroundFloorAgainstOwnCanvas`, `TestTextDimHeldToThreeToOneFloor`, `TestTextFaintDecorativeBand`, `TestBgSelectionPairRule`, `TestBgWarningPairRule`, `TestInlineFlashWarningPairClearsFloor`, `TestPreviewPeekChromeClearsFloorAgainstCanvas`, `TestBgTrackPairRule`, `TestForegroundOnTintPairings`, `TestStateGreenClearsCanvasAndSelection` | **All rewritten.** Each is built on four things this feature removes: they read `theme.MV.<Field>` (a package value §3.2 deletes), address `.Dark`/`.Light` on a `Token` (a shape §3.2 collapses), run a `/dark` + `/light` subtest pair per token (a mode axis that no longer exists), and measure against the `canvasDark`/`canvasLight` constants (§13.5 and §15.2 retire both in favour of the theme's own `canvas`). Each must additionally gain §13.5's auto-enumeration over the embedded set, which is a structural change — a loop over themes wrapping the loop over tokens — not a rename. **They do not compile after §3.2**, and together they are the single largest mechanical surface in the reshape. Two of them are the named carriers of rules §13.5 states canonically: `TestBgWarningPairRule` is the three-leg warning band, `TestStateGreenClearsCanvasAndSelection` is the dual clearance that caught the Nord green. (`TestContrastMath` is pure ratio math and is genuinely untouched — the one member of the file that is.) |
| **Panel behaviour test** | **New**, driven through the `ThemeEnumerator` seam (§13.3), which §13.3 requires as an architectural commitment rather than a convenience. The panel carries a large body of exactly-specified, purely deterministic behaviour that nothing else covers: §9.5's sort key rules including the guaranteed `reserved name`/built-in tie and its built-in-first resolution; the four-element row-composition priority and its truncation floor; the three-row badge derivation table, including the shipped-default row that is the most common install; §9.4's union and its one-slug-one-row rule; §9.2's commit recompute and identity-anchored cursor; the confirm's three-input resolution and swallow-everything-else rule; and §9.13's outstanding-failure state machine. All pure functions of injected state, so cheap to cover and expensive to leave to inspection. (`keymap_dispatch_guard_test` covers the descriptor, not any of this.) |
| **Nomination resolution + fallback test** | **New**, and distinct from §7.6's build-time guarantee, which proves the fallback *slugs* resolve within the embedded set. This covers the resolution *path*: §8.5's per-slot mode-matched fallback selection, §8.4's embedded-set-before-directory ordering — which is what carries §5.4's no-shadowing safety property on the non-enumerating construction path — and §8.6's charset validation of a **persisted** slug before it is used as a path component. The loader test covers the charset rule as a rule; this covers it as applied to the value where `../something` would otherwise become a path component. |
| **Embedded-set validity + fallback-slug resolution** | **New** (§7.6). |
| **Swap-and-diff completeness guard** | **New** (§13.4). |
| **`RestoreTerminalBackground` anchor test** | **New** (§11.4). |
| **`docs/theming.md` token-table guard** | **New** (§13.5). |
| **`keymap_dispatch_guard_test`** | Extended to cover the panel scope (§9.12). |
| **Colour-literal guard** | Unchanged in mechanism and unchanged in scope — it still scans `internal/tui`. **Its `theme`-subpackage exemption is deleted rather than re-pointed**: §3.2 moves that package out to `internal/theme`, so there is nothing under `internal/tui` left to exempt, and widening the guard's globs to reach a sibling purely in order to exempt it would be a mechanism change. The exemption has also lost its reason — it existed so `theme.MV` could declare hexes, and after §7.1 the new package holds **no hex values at all**; they live in the embedded `.theme` files. |

## 14. Footer keymap revision

This is a change to the existing MV spec §12.2 keymap revision, driven by discoverability: the feature would otherwise be near-invisible — `--theme` and `portal theme list` ruled out, the themes directory silent and never seeded, built-in rows indistinguishable from drop-ins, the reserved-slug set invisible, and no active-theme indicator when the panel is closed. Discoverability would rest entirely on `?` help and `docs/theming.md`.

### 14.1 The change

- **Drop `↑↓ navigate` from the footer.** Arrows in a list are a given, and arrows are the entry that genuinely deserves non-core status — still listed in `?` help. This is the distinction (core vs non-core) applied to the right thing.
- **Promote both `t` and `m` to core**, so both appear in the footer as well as `?` help.

### 14.2 Decided footers

- **Sessions** — `⏎ attach · / filter · ␣ preview · s switch view · x projects · t theme · m multi` + right-aligned `? help`
- **Projects** — `⏎ new session · x sessions · e edit · / filter · t theme` + right-aligned `? help`

### 14.3 Width, measured rather than assumed

Dropping `↑↓ navigate` frees ~93px; `t theme` costs ~61px and `m multi-select` ~116px, netting **+84px** against an 89px spacer at the reference mock's 86-column width — it fits with ~5px spare and no headroom.

**The label is therefore `m multi`, not `m multi-select`**, buying back ~47px.

The Projects footer was verified against the `Projects (MV)` frame: it carries no `navigate` today and has ~322px of slack before `? help`.

**The footer is filtered in lockstep with `?` help.** A blocked `t` (under `NO_COLOR`, §9.10) or a blocked `m` (unsupported terminal) is absent from **both** surfaces, through the same call-site filter. Advertising a key in the footer that only produces a blocked flash is the dead-end the proactive block exists to prevent, and help/footer disagreeing about the same key is a live inconsistency.

**Consequence for the width budget:** §14.3's arithmetic is measured with both entries present, which is the tight case. Filtering only ever removes entries, so every blocked-state footer is strictly narrower and no separate budget is needed.

**The Projects footer needs its own call-site filter.** §9.10 names `sessionsHelpKeymap()`, but §14.2 puts `t theme` in the Projects footer too, so the Projects keymap needs the matching filter for a blocked `t`. Same mechanism, second call site.

### 14.4 Below the reference width — the footer degrades right-to-left

The Sessions footer fits at 86 columns with **no headroom**, so narrower terminals are a live case rather than a theoretical one. MV §2.7's ladder covers the header and rows, not the footer.

**Rule: drop footer entries from the right until the row fits, and never wrap or truncate a label.** A half-rendered key hint is worse than an absent one — the footer's job is to advertise what is available, and a truncated `x proje…` advertises nothing while costing the same space.

**`? help` is never dropped.** It is right-aligned and it is the escape hatch that makes every dropped entry recoverable: the help modal lists the full keymap regardless of footer width, so a user on a narrow terminal loses the reminder, not the capability.

Below the width where `? help` alone fits, the footer renders empty — consistent with §2.7's degrade-never-break doctrine, and Portal's documented 40-column minimum sits well above it. **Exact thresholds are pinned at implementation**, as §2.7 already does for its own steps.

---

## 14A. User-facing copy

Every new user-facing string is pinned here, following Portal's existing convention of single-sourcing exact copy (`spawn.UnsupportedNoopMessage`). These are the whole feedback surface for states the user cannot otherwise diagnose, and in the panel the wording is a **layout constraint** as much as a copy choice — it has to fit 24–30 columns.

**Panel — message slot (§9.1):**

| State | Copy |
|---|---|
| Slot-from-constant confirm (§9.2) | `clear constant <slug>?  y / n` — the slug truncated by §9.5's rule if needed |
| Failed commit write (§9.13) | `⚠ couldn't save theme` |

**Panel — rows (§9.5):** §6.2's reason labels verbatim, each prefixed `⚠ `. The pinned directory row is `⚠ dir unreadable`.

**Panel — header and footer (§9.1):** header `Themes`; footer `⏎ set theme` / `d set as dark` / `l set as light` / `esc close`.

**Flashes (main screen):**

| Trigger | Copy |
|---|---|
| `t` under `NO_COLOR` (§9.10) | `theme picker needs colour — NO_COLOR is set` |
| `t` below the **width** floor (§9.8) | `terminal too narrow for the theme picker` |
| `t` below the **height** floor (§9.8) | `terminal too short for the theme picker` |
| Resize below the **width** floor with the panel open (§9.8) | `terminal too narrow — theme picker closed` |
| Resize below the **height** floor with the panel open (§9.8) | `terminal too short — theme picker closed` |
| Panel closed with a failed commit outstanding (§9.13) | `theme not saved — see portal.log` |

**Notice-band precedence for these flashes.** The band is a single-slot arbiter whose existing order is *burst progress → transient flash → multi-select banner → unsupported banner → no-tags signpost*, with the filter line conventionally listed above it all. All six theme signals route through the **transient flash** slot, which composes correctly with everything below it — a flash outranks the multi-select banner, so the nesting §9.7 allows works — and needs no answer for burst progress, since §9.7 swallows `t` during a pending burst.

**The filter line is the one thing above flash that can be live throughout a panel open/use/close, and every theme flash still reaches the band while it is — because the filter line is not a band contender at all.** It occupies the **section-header row**, rendered by `applySectionHeader` below the band slot and its blank breathing row, so an applied-but-unfocused filter leaves the single slot free and arbitrates for nothing. That is what secures two decided guarantees which would otherwise fail silently:

- §9.13's failed-commit report would never reach the band — and because raising the flash **discharges** the outstanding state, the report would be destroyed rather than deferred. That is the silent revert the section exists to close.
- §9.10's proactive `NO_COLOR` block would produce nothing at all, which is the walkable dead end it exists to prevent, reached by another route.

A filter line is a persistent restatement of a state the user can already see in their own list; each theme flash reports a one-time event with no other surface — which is why the flash holding the band while the filter row stands untouched beneath it is the right outcome. **This is therefore no change to the band's arbitration**: the theme signals are enrolled in the standing transient-flash slot, and the theme tier `setThemeFlash` stamps is a forward guard for a future contender rather than a win over the filter line, which the band cannot produce.

**Projects gains a transient-flash slot.** The existing arbiter is Sessions-only — every one of its six contenders is a Sessions element — yet §9.6 binds `t` on Projects and §14.2 puts `t theme` in its footer, and all six of these flashes are reachable there. **Projects gets the flash contender alone**, not the full arbiter: no other contender has a Projects analogue, and inventing them would be scope for nothing.

The two alternatives each destroy a decided guarantee. Suppressing the flashes on Projects makes §9.10's proactive block a silent no-op — the walkable dead end it exists to prevent — and makes §9.13's report vanish outright, since closing the panel discharges the outstanding state whether or not a flash rendered. Refusing `t` on Projects contradicts §9.6, which binds it there precisely because theme is a global setting.

**§13.3 accordingly requires one Projects-with-panel fixture**, so the page is seen with the panel over it before release rather than after.

**`portal theme export` (§12.1), stderr, exit 1:**

| Case | Copy |
|---|---|
| Unknown slug | `no theme named <slug>` |
| Invalid drop-in | `theme <slug> is not valid: <reason>` |
| Slug fails the charset check | `theme <slug> is not valid: bad name` |
| Unreadable | `theme <slug> could not be read: <OS error>` — a separate frame, because the file is not *invalid*: nothing was read, so "is not valid" would describe a judgement that was never made |

**`portal doctor` (§12.2)** — one advisory line per finding, `⚠`-marked, detail after a colon:

| Case | Copy |
|---|---|
| Invalid theme file | `⚠ theme <slug>: <reason> — <detail>` where detail enumerates within the reason (e.g. `missing text.primary, bg.subtle`) |
| `bad name`, bad **slug** | `⚠ theme file <filename>: slug must be lowercase letters, digits and hyphens` |
| `bad name`, bad **extension casing** | `⚠ theme file <filename>: extension must be lowercase .theme` — a distinct message because the slug portion is already legal, and sending the user to fix the one thing that is fine is exactly the misdirection §9.4 and §12.1 discriminate against elsewhere |
| `reserved name` conflict | `⚠ theme file <filename>: <slug> is a built-in — rename it (e.g. <slug>-mine.theme)` — the message names the conflict *and* the fix, which is what makes §5.4's workaround self-documenting rather than merely short |
| Persisted theme unresolvable | `⚠ theme <slug> (<slot>) does not resolve: <reason>`. `<slot>` renders `light` or `dark` under an adaptive pair, **`both` when the two slots name the same slug** (§9.5's `● both` state, reachable in two keypresses), and the parenthetical is omitted entirely under a **constant** — `⚠ theme <slug> does not resolve: <reason>`. One line in every case, per §12.2's one-slug-one-line rule, which two lines for one slug would break along with `<M>`'s problems-not-detections property. The log is already asymmetric-free here: `theme: fallback applied` dedups on `slug`+`reason`, so it emits once for the two failed slots regardless. |
| Themes directory unusable | `⚠ themes directory unreadable: <path>` |
| Closing summary, all checks passed | `<N> checks passed` |
| Closing summary, some checks failed | `<N> of <T> checks passed` — the failing case is the one the summary exists for, since it is when the exit code needs explaining |
| Closing summary, advisories present | Either form above plus ` · <M> advisory` at M=1, ` · <M> advisories` above. Suppressed entirely at M=0 |

`<N>` and `<T>` count **Portal-health checks only** — the class that drives the exit code (§12.2). Advisories are counted separately by `<M>` and never fold into either, which is the whole point of distinguishing them. The summary line is **new**: today's report is a header plus one line per check with no trailing summary, so every run gains a line — that is the amendment §15.1 names, not a regression.

**`<detail>` formats**, since §6.2/§6.3 push all discrimination here and doctor has the width for it:

| Reason | Detail |
|---|---|
| `missing tokens` | The token names, comma-separated: `missing text.primary, bg.subtle` |
| `bad colour` | Every offending `key = value` pair, comma-separated: `text.primary = #GGGGGG, canvas = blue` |
| `bad syntax` | Line number and the offending content: `line 12: duplicate key text.primary` / `line 4: quoted value` / `line 7: not a key = value pair`. A duplicate names the **second** occurrence's line, which is the one to delete |
| `unreadable` | The OS error verbatim — it is the only thing that distinguishes a permission denial from a dangling symlink, and doctor is where a verbatim system message belongs |
| `reserved name` | Covered by its own pinned line above, which names the conflict and the fix rather than following the generic frame |

**Fatal startup message (§7.6)**, on the should-never-happen path where a fallback slug does not resolve within the embedded set: `built-in theme <slug> is missing or invalid — this binary is broken`. Terse is right for a path the build-time guarantee makes unreachable, but it is still new copy and is pinned rather than left implicit.

Copy that is **not** pinned here is unchanged from what already ships.

---

## 15. Spec amendments this feature carries

The Modern Vivid specification is amended by this feature's work. Named explicitly so none is missed:

### 15.1 The three named amendments

1. **MV spec §12.2 — the keymap revision.** The footer changes of §14 above.
2. **The `portal doctor` contract.** Two classes of line — Portal-health checks driving the exit code, user-content diagnostics carrying `⚠` and not driving it — plus a closing summary distinguishing the counts (§12.2).
3. **The log-component vocabulary.** A new `theme` component with its own attr keys and event catalogue (§12.3).

### 15.2 The MV vocabulary sections

Also amended, as spec-phase work rather than left unowned:

| Section | Amendment |
|---|---|
| **§2.1 / §2.9** | The token renames (§2.4), 20 → 19, the dropped `border.footer`. |
| **§2.9** | The removal of `Token.ColorFor` and `theme.Mode`; the two-hardcoded-canvas framing goes — each theme carries its own `canvas` token and contrast is measured against it. |
| **§8.1** | The stale "2-tone border (`border.separator` + `border.footer`)" claim, which the implementation already dropped. |

### 15.3 Where the vocabulary lives after this feature

The 19 roles are described in four places. Their standing is not equal:

| Location | Standing |
|---|---|
| **`docs/theming.md`** | **The source of truth for the public contract** — the 19 roles, their meanings, the ramp's weight ordering. Guarded (§13.5). |
| **The MV spec** | Amended per §15.2. Design rationale and contrast rules. |
| **The doc's example theme** | Covered by the same guard as the doc — must parse and contain all 19 keys, so it is not an unguarded fourth copy. |
| **The embedded `.theme` files** | The values themselves. Guarded by the embedded-set validity test (§7.6). |

### 15.4 The MV Paper frames are historical, not specification

**Modern Vivid is already implemented, so the code is the source of truth.** The MV Paper frames are historical reference from that feature's design phase; a footer in them that no longer matches (e.g. still showing `↑↓ navigate`) is **not a defect** and is not worth updating.

Only the **new** frames are forward-looking reference material, because they describe surfaces that do not exist yet:

- `Theme slide-over — A (inline slot badges)`
- `Theme slide-over — A (constant set, previewing another)`
- `Theme slide-over — B (assignment header)` (the rejected treatment)
- `Sessions — Nord (port)`
- `Kill Modal — Nord (state.destructive #DD8188)`
- `Sessions — Nord inline flash (bg.attention #3D4046)`

**And even those are reference, never truth:** the Paper mocks use per-frame literal hexes, so the same token can carry different values across frames. That is exactly the drift the token layer prevents in code.

---

## Working Notes

## Corrigenda

> **Corrigendum 2026-08-14** (from the `theming-system` implementation review): §9.1's header paragraph had the label "followed by" the one-row `border` rule — corrected: the panel renders **rule then label**, because the rule sits in the page's own rule lane, which is what lands `Themes` on the page's section-header row.
> **Corrigendum 2026-08-14** (from the `theming-system` implementation review): §14A ranked the filter line as a band contender above the transient flash and called the theme flashes "a change to the band's precedence" — corrected: the filter line renders on the **section-header row** through `applySectionHeader` and never contends for the band slot, so the guarantee holds because the slot is free, not because a theme flash outranks anything; the band's arbitration is unchanged by this feature.
