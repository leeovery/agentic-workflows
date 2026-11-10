# User-overridable theme system

A follow-on to the `spectrum-tui-design` redesign. That work tokenises every
colour in the TUI into a single built-in **"Modern Vivid"** theme — a set of
role tokens (primary accent, detail/secondary, semantic state, and a
filter/search accent), each carrying a light and dark `AdaptiveColor` variant.
Crucially, the renderers reference *tokens*, never hardcoded hex. That leaves the
app **theme-ready**: the layout is locked and only the colour layer is
parameterised.

This idea is the natural next step: let the **user** override the theme rather
than only shipping the one built-in. The shape to design separately:

- **External theme file.** Load a user theme from config (e.g.
  `~/.config/portal/theme.json` or `.toml`) that overrides the built-in role
  tokens. Merge-over-default so a partial theme only changes what it specifies.
- **Multiple built-in themes + a selector.** Ship more than one curated theme and
  expose a `theme` setting so users can switch without writing a file.
- **Validation against the contrast floor.** The redesign establishes a WCAG-AA
  contrast floor for legibility. Because Portal does not own the terminal
  background, a user's chosen colours could be unreadable — so user themes need a
  validation pass: warn (advisory) when a token falls below the floor, or clamp
  it. This is the genuinely hard/interesting part and the main reason it's its own
  initiative rather than a sub-task.
- **Documentation.** A documented token vocabulary (what each role means, where it
  appears) so theme authors know what they're setting.

Constraints carried over from the redesign: the visual *layout* is fixed — themes
change colour only, not structure. Colours stay `AdaptiveColor` (light/dark) and
truecolor-first with graceful downsampling; `NO_COLOR` and terminal
colour-capability handling are already in scope for the redesign and interact
with this.

Deferred deliberately so it doesn't bloat the redesign feature, which ships the
single built-in theme. Source discussion (see the "Theming system" section):
`.workflows/spectrum-tui-design/discussion/spectrum-tui-design.md`. Likely lives
near the existing colour/style code in `internal/tui` plus a small theme
loader (config resolution already exists via `cmd/config.go` /
`internal/xdg`).
