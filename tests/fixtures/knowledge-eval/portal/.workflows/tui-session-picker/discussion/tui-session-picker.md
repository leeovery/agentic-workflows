---
topic: tui-session-picker
status: concluded
work_type: feature
date: 2026-02-27
---

# Discussion: TUI Session Picker

## Context

The current TUI (`portal open` / `x`) has three separate views: session list, project picker, and file browser. The session list is the default view, with "[n] new in project..." as a gateway to the project picker sub-screen. This creates UX friction — projects aren't discoverable, section context is missing, keybindings are hidden, and navigation requires learning the sub-screen flow.

The original proposal (from `tui-session-picker-ux.md`) was to merge sessions and projects into a single scrollable screen. Through discussion, this evolved into a two-page architecture using `bubbles/list` — see questions below for the full journey.

### Current Architecture

- `internal/tui/model.go` — Main model with `viewState` enum (`viewSessionList`, `viewProjectPicker`, `viewFileBrowser`)
- `internal/ui/projectpicker.go` — Separate project picker sub-view with its own model
- `internal/ui/browser.go` — File browser sub-view
- Views communicate via message types (`BackMsg`, `ProjectSelectedMsg`, `BrowseSelectedMsg`, etc.)
- `strings.Builder` rendering with basic lipgloss styles, no borders/frames/sections

### References

- [tui-session-picker-ux.md](../../tui-session-picker-ux.md) — UX design document
- [tui-redesign discussion](.workflows/discussion/tui-redesign.md) — Prior discussion on visual frame/layout

## Questions

- [x] How should the unified single-screen list be modeled — one model or composed sub-models?
- [x] Should sessions and projects be one list or two pages?
- [x] How should page switching and keybindings work?
- [x] How should filter (`/`) work?
- [x] What happens to command-pending mode (`portal open -e cmd`)?
- [x] How should empty states be handled (no sessions, no projects, both empty)?
- [x] What's the right approach for the `[b] browse for directory...` item?
- [x] How should the `n` key auto-execute behavior work?
- [x] Should we adopt `bubbles/list` and other bubbles components?
- [x] How should kill confirmation, rename, and project edit work with `bubbles/list`?
- [x] How should inside-tmux mode work?
- [x] How should session refresh after kill work?
- [x] How should file browser return path work?
- [x] How should initial filter (`--filter` flag) work?

---

*Each question above gets its own section below. Check off as concluded.*

---

## How should the unified single-screen list be modeled?

### Options Considered

**Option A — Single unified model.** One flat list of items (sessions + projects + browse entry), one cursor, one `Update`. Item type determines available actions. `ProjectPickerModel` retired — its edit/remove logic moves into the unified model or becomes modal.

**Option B — Composed models.** Keep session and project sub-models, render together in a single `View()`. A coordinator tracks which section the cursor is in and delegates key events.

### Decision

**Single unified model (Option A).** The whole point is one scrollable list with one cursor — composition adds coordination complexity for something that's conceptually one list. The existing `ProjectPickerModel` is retired. Project-specific actions (edit, remove) will be handled within the unified model, likely as modal states.

**Note**: This decision was later superseded by the two-page architecture decision below. The unified model concept still applies — each page is its own `bubbles/list.Model` rather than hand-rolled.

---

## Should sessions and projects be one list or two pages?

### Context

The original UX doc proposed a single scrollable screen with "Sessions" and "Projects" sections. We needed to decide whether this was achievable with the available components.

### Options Considered

**Option A — Single list with contextual rendering.** Sessions and projects in one flat `bubbles/list`. Custom `ItemDelegate` renders sessions differently from projects (attached badge, window count vs path). No headers — visual distinction does the work.

**Option B — Two stacked `bubbles/list` components.** One for sessions, one for projects, rendered vertically in the same view. Tab switches focus. Each has its own cursor, filtering, pagination.

**Option C — Two separate pages.** Each page is a full `bubbles/list` with title, filtering, help bar. A key toggles between them. Only one visible at a time.

### Journey

Started with Option A (single unified list). Discovered `bubbles/list` has no native section/group/header concept — items are a flat `[]list.Item`. Explored rendering section headers via the delegate (e.g., rendering a "Projects" label above the first project item). This felt like fighting the component.

Explored Option B (two stacked lists). Workable but breaks the "one cursor" mental model — you're managing focus between two list components in the same view.

Considered whether contextual rendering alone (Option A without headers) would be enough — sessions show window count + attached badge, projects show path. The visual distinction exists, but with a short list (2 sessions, 2 projects) it could feel like "four things that happen to look different" rather than two clear categories.

Landed on Option C. Two pages, equal hierarchy. Each page is a proper `bubbles/list` with all built-in features (title, filtering, pagination, help). This actually solves the original UX complaints better than the single-screen mockup — projects aren't buried behind a gateway, each page has focused keybindings, section context is the page title itself.

### Decision

**Two separate pages (Option C).** Sessions page and Projects page as equal peers, not parent-child. Each is a full `bubbles/list.Model`. Default page is sessions if any exist, otherwise projects. Toggling to an empty page still works — consistent navigation.

---

## How should page switching and keybindings work?

### Context

With two pages, we need a clear, discoverable way to switch between them, plus per-page keybindings.

### Options Considered

**Tab toggle** — simple, one key. But ambiguous ("which page am I going to?").

**Named keys** — `p` for projects, `s` for sessions. Self-documenting, you always know the destination.

**`x` toggle** — mirrors the shell command (`x` launches Portal). Nice symmetry but same ambiguity as Tab.

### Journey

Started with Tab as the obvious choice. Then explored using `x` as a toggle — there's nice symmetry with `x` being the shell alias for `portal open`. But toggle keys are ambiguous about destination.

Named keys (`p`/`s`) are self-documenting. Decided to use both: `p`/`s` as the advertised keys (shown in help bar), `x` as an undocumented power-user toggle.

For per-page keybindings, explored whether `r` could mean "rename" on sessions and "remove" on projects. Decided against the overloading — too easy to confuse. Remove became "delete" with `d` instead.

All keybindings standardized to lowercase.

### Decision

**Page switching:**
- `p` — go to projects (shown in sessions help bar)
- `s` — go to sessions (shown in projects help bar)
- `x` — toggle between pages (undocumented power-user shortcut)

**Sessions page keybindings:**
`[enter] attach  [r] rename  [k] kill  [p] projects  [n] new here  [/] filter  [q] quit`

**Projects page keybindings:**
`[enter] new session  [e] edit  [d] delete  [s] sessions  [b] browse  [/] filter  [q] quit`

---

## How should filter work?

### Decision

**Independent filters per page.** Each `bubbles/list` manages its own filter state. Filtering sessions doesn't affect projects and vice versa. Switching pages doesn't carry filter text across. This is the default `bubbles/list` behavior — no extra work needed.

---

## What happens to command-pending mode?

### Context

Currently `portal open -e cmd` skips the session list and opens the project picker directly. With two pages, we need to decide how this mode works.

### Journey

Considered allowing switching to sessions during command-pending mode. But attaching to an existing session doesn't make sense when you have a command to run — existing sessions are already doing something. The question became how to communicate *why* the switch is disabled.

### Decision

**Command-pending mode locks to the Projects page.** `s` and `x` keybindings are not registered — pressing them does nothing, and they don't appear in the help bar.

Title stays "Projects" for consistency. A status line below indicates the pending command: `Select project to run: {command}`.

Help bar in command-pending mode:
`[enter] run here  [b] browse  [/] filter  [q] quit`

Selecting a project creates a session with the command and attaches. `q`/`Esc` cancels entirely.

---

## How should empty states be handled?

### Decision

**Default page based on what exists:**
- Sessions exist → default to Sessions page
- No sessions, projects exist → default to Projects page
- Both empty → default to Projects page (useful action is `b` to browse)

Empty pages are always reachable via `p`/`s` — show the `bubbles/list` built-in empty message ("No sessions running" / "No saved projects"). Consistent navigation regardless of state.

---

## What's the right approach for browse?

### Options Considered

**Option A — List item.** "Browse for directory..." as the last item in the projects list. Custom delegate renders it differently. But it's an action, not a project — filtering might hide it.

**Option B — Keybinding only.** `b` opens the file browser from anywhere on the Projects page. Not a list item — shown in the help bar. Always accessible regardless of filter state.

### Decision

**Keybinding only (Option B).** `b` opens the file browser as a separate sub-view. Always accessible, not polluted by filtering, cleaner list. File browser sub-view remains as-is — `Esc` returns to Projects page.

---

## How should the `n` key auto-execute behavior work?

### Decision

**`n` immediately creates a session in cwd and attaches.** No confirmation, no cursor movement — same as `portal open .` / `x .`. Works from both pages (cwd doesn't change based on page). Works in command-pending mode (creates session in cwd with the pending command). No spinner — session creation is near-instant.

---

## Should we adopt `bubbles/list` and other bubbles components?

### Context

The current TUI is entirely hand-rolled with `strings.Builder` and basic lipgloss styles. `bubbles` provides ready-made components — the question is which to adopt.

### Journey

Evaluated `bubbles/list` — it provides filtering, pagination, help bar, status bar, custom delegates, spinner, and keybinding management. Covers almost everything the UX doc calls for. The only missing feature is section grouping/headers, which drove the two-page architecture decision.

Evaluated `bubbles/filepicker` as a replacement for the custom file browser. The filepicker shows files and directories (Portal only needs directories), has no fuzzy filtering, and doesn't support alias saving or current-directory selection. Too many gaps — wrapping it would be more work than keeping our own browser.

Other components evaluated: `viewport` (not needed, `list` handles scrolling), `table` (list with delegates is more flexible), `spinner` (not needed for session creation), `progress`/`textarea`/`timer` (no use case).

### Decision

**Adopt `bubbles/list`** for sessions and projects pages. This brings `help`, `key`, and `paginator` along automatically. Continue using `textinput` for rename/edit inputs. **Keep the custom file browser** — it's purpose-built for directory-only navigation with fuzzy filtering and alias support.

---

## How should kill confirmation, rename, and project edit work?

### Context

The current kill confirmation, rename mode, and project edit mode all render inline in the list. With `bubbles/list` owning the rendering via delegates, we needed a new pattern.

### Journey

Initially proposed delegate-level rendering — the delegate checks model state and renders the highlighted item differently (e.g., showing "Kill X? (y/n)" or a `textinput` inline). This works but means delegates need to know about multiple modal states.

Then explored modal overlays — a styled lipgloss box rendered on top of the list in `View()`. Bubble Tea doesn't have built-in modals, but `lipgloss.Place()` can position content over the list output. All key input routes to the modal while it's open.

Modal pattern unifies all action prompts into one consistent UX: action triggers modal, list stays visible but inactive behind it, Esc always dismisses. Kill, rename, and project edit all use the same infrastructure with different content.

Briefly considered offering both modal and inline (e.g., `r` for modal rename, `R` for inline) as a way to test which feels better. Decided against — ship modal first, refactor to inline later if it feels wrong. Cheaper than maintaining two paths.

### Decision

**Modal overlays for all action prompts.** Single reusable modal pattern:
- **Kill**: small modal — "Kill {name}? (y/n)"
- **Rename**: small modal with `textinput` pre-populated with current session name
- **Project edit**: larger modal with name field, alias list, full edit controls

List renders normally behind the modal. All input routes to the modal while active. Esc dismisses.

---

## How should inside-tmux mode work?

### Decision

**Exclude current session from the items list** — filter it out before calling `SetItems()`. Display "Current: {session}" in the **list title**, e.g., `Sessions (current: my-app-x7k2)`. Persistent context, always visible at the top.

---

## How should session refresh after kill work?

### Decision

**Kill session via tmux, fetch fresh list, call `SetItems()`.** `bubbles/list` handles cursor repositioning automatically. If killed session was the last one, list shows empty state. User can press `p` to go to projects.

---

## How should file browser return path work?

### Decision

**Same as current behavior.** Browser emits `BrowserDirSelectedMsg{Path}` → parent creates session and exits TUI. Browser cancelled (`BrowserCancelMsg`) → return to Projects page. No change in flow, just the return destination is explicitly the Projects page.

---

## How should initial filter work?

### Decision

**Apply to the default page during initialization.** Call `SetFilterText()` and `SetFilterState(list.FilterApplied)` on whichever page is the default (sessions if they exist, otherwise projects). Same behavior as current, just using `bubbles/list` API.

---

## Summary

### Key Insights

1. `bubbles/list` lacks section/group support, which drove the two-page architecture — but two pages turned out to be a better UX than the original single-screen proposal anyway
2. Modal overlays provide a consistent pattern for all action prompts (kill, rename, edit) without fighting the list delegate rendering
3. `bubbles/filepicker` doesn't fit Portal's directory-only, fuzzy-filtering, alias-saving use case — keep the custom browser
4. The original UX complaints (undiscoverable keybindings, buried projects, no section context) are all solved by `bubbles/list`'s built-in help bar, two equal-hierarchy pages, and page titles

### Current State

All questions resolved. Architecture is clear:
- Two-page TUI using `bubbles/list` (Sessions + Projects)
- `p`/`s` for named switching, `x` as undocumented toggle
- Modal overlays for kill/rename/project-edit
- Custom file browser retained
- Command-pending mode locks to Projects page

### Next Steps

- [ ] Specification — formalize the decisions into a buildable spec
- [ ] Implementation — rebuild TUI on `bubbles/list` with two-page architecture and modal system
