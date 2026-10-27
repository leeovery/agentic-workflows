# Specification: Session Tagging and Grouping

## Specification

## Overview

Portal's `open` session list presents all live tmux sessions in a flat, alphabetical list. At the user's typical working load (~15–20 concurrent sessions) a flat list stops being legible. This feature adds an **on-demand grouped session list** with a toggle to cycle between viewing modes.

The grouping is powered by **tags**. Tags are the mechanism; the goal is the grouped, toggleable list. Grouping by directory/project comes "for free" (derivable from where a session lives); grouping by an arbitrary user dimension (Personal / Work / BusinessA) is what tags provide.

## Goal

Let the user slice the live session list multiple ways and aggregate sessions into logical groups, flipping between views with a single key.

## v1 Scope

v1 ships the **directory/project tag layer only**:

- A directory (equivalently, a project — "projects are just stored git-root directories") carries zero or more tags.
- Every session started in a directory **inherits** that directory's tags (a live lookup — no per-session tag storage in v1).
- The session list renders in three modes — **Flat → By Project → By Tag** — cycled with a single key.
- Tags are assigned/managed in the existing **projects edit modal** (TUI only).

**Effective tags of a session in v1 = its directory's tags.** (No union with per-session tags, no overrides — that's the deferred second layer.)

## Non-Goals (deferred)

These are explicitly out of v1 scope. v1 is purely additive and locks none of them out:

- **Per-session tags + `portal open --tag=`** (and `x --tag=`) — the eventual hybrid model's second layer: a per-session `@portal-tags` tmux option, settable at launch. Deferred. This layer is precisely what the directory-anchored v1 avoids: because `@portal-tags` is in-memory tmux server state, surviving a reboot would require capturing it into `sessions.json` (a modest, bounded addition to the `Session` record), reading it on daemon capture, and re-applying it on restore (interacting with the `@portal-restoring` window). The directory anchor needs none of this — directory tags ride the `projects.json` project record. That cost contrast is why v1 stops at the directory layer.
- **Live-grouped filtering** — keeping group headers visible while the `/` filter is active. Deferred as its own separate feature (would require Portal to own the filter wholesale). v1 flattens on filter.
- **Tag exclusion / hide-a-tag** — a filter layer on top of grouping. Deferred power-feature. The deferral is acceptable because the existing `/` filter covers basic narrowing in the meantime; revisit only if a concrete "tag I never want to see" pain appears.

## Guiding Invariant — Additive, No Regression

The feature is **purely additive**. Flat mode, the zero-tag state, and the all-tags-deleted state are byte-for-byte today's session list. Grouping appears only on opt-in (the toggle key). **By Project** delivers value with zero setup; **By Tag** fills in as the user tags directories.

## Tag Data Model & Persistence

### Storage

Tags are stored on the **project record** in `~/.config/portal/projects.json`. The existing `Project` record (`{path, name, last_used}`) gains a **`tags []string`** field.

- A directory carries **multiple tags** — this is what lets one project appear under several tag groups simultaneously.
- Reuses the existing JSON store machinery: `AtomicWrite` (temp file + rename) and `configFilePath` resolution. No new store, no new persistence pattern.

### Back-compatibility

Existing `projects.json` records predate the `tags` field. A missing `tags` field decodes to nil/empty — exactly the zero-tag state. No migration is required; un-tagged projects behave as today.

### Tags are implicit (no registry)

There is **no separate "create tag" step and no tag registry**. The set of tags that exists is the **union of `tags` across all project records**. Applying `work` to a second directory auto-joins the existing `work` group; removing the last `work` tag makes the group cease to exist. Tags come into and out of existence purely as a side effect of being applied to projects.

### Tag value normalisation & validation

Because a tag value is also the **grouping key** (it becomes a By-Tag heading and drives the implicit-union dedup), value handling is load-bearing and must be defined — the alias field has no equivalent consequences. v1 rules:

- **Whitespace:** leading/trailing whitespace is **trimmed** on add. `"  work "` is stored as `work`.
- **Empty / whitespace-only:** rejected. Pressing Enter on a blank (or whitespace-only) input is a **no-op** — no tag is added.
- **Case:** the **canonical form is lower-cased**. `Work`, `WORK`, and `work` are the **same tag** — they collapse into one By-Tag heading and dedup in the union. Tags are stored and displayed in this canonical lower-cased form (no separate display casing in v1).
- **Duplicate within a project:** adding a tag a project already carries (after normalisation) is a **no-op** — `tags` is a deduped set per project, so a project never appears twice under one heading.
- **Allowed characters / length:** no character whitelist and no hard max length in v1 (freeform, like aliases). The trim + lower-case + non-empty + per-project dedup rules above are the complete validation set.

The same canonical form (trim + lower-case) is used everywhere a tag is compared: per-project dedup, the cross-project union that defines "which tags exist," and By-Tag grouping.

### Taggable surface — projects only

The projects edit modal is the **only** origin for tags, and it lists **known projects only**. Because every session creation upserts a project (`session.PrepareSession` → `store.Upsert(resolvedDir, projectName, "internal")` keyed by git-root), any directory opened in Portal at least once is a project and therefore taggable.

A directory **never opened in Portal** is not a project and cannot be pre-tagged. This is an accepted v1 boundary: **open a directory once, then tag it.** No bare-directory tagging in v1.

### Lifecycle — no orphan-tag cleanup needed

Tags live on the project record in `projects.json`, not in a separate store. They persist with the project and are removed when the project is deleted (projects-page `d`). There is no separate tag store to garbage-collect and no orphan-tag sweep (unlike hooks/markers). The `@portal-dir` session stamp (see *Session → Directory Resolution*) is ephemeral and dies with the session — nothing to GC there either.

## Session → Directory Resolution

Grouping a session — by project or (via inheritance) by tag — requires mapping each **live** session back to its directory. This is the one genuine piece of new mechanism the feature needs.

The session **name cannot** do this: a name is `{project}-{nanoid}` at birth, but the user renames sessions freely. A session knows its directory only via its panes, which roam.

### The stamp (fast path)

At session creation, Portal stamps the tmux session user-option **`@portal-dir = <resolvedDir>`**, where `<resolvedDir>` is the git-root already computed in `session.PrepareSession`.

- **Survives rename** — the option rides the session *object*, not its name.
- **Survives pane `cd`** — stamped once at create, never re-derived from live pane cwd.
- **Cheap to read** — the grouped render reads it in the same `list-sessions -F` pass that already fetches session names (append `#{@portal-dir}` to the format string). No `git rev-parse` per session per render.

The grouped render uses `@portal-dir` to look up the directory's `Project` record and its `tags`.

### The lazy stamp-on-render fallback (stamp absent)

`@portal-dir` is the fast path, not a guarantee. When the grouped render encounters a session with **no `@portal-dir`**, it resolves that session's directory from the **active pane's current path → git-root** and **stamps `@portal-dir` then and there** (lazy). After that first grouped render the session is on the fast path.

One mechanism covers **both** stamp-absence cases — no schema change, no restore-engine change, no first-boot backfill:

- **Post-reboot:** restored sessions return without the option (`@portal-dir` is in-memory tmux state, not persisted in `sessions.json`). The first grouped render re-derives and re-stamps. There is no need to persist the resolved directory into the session record.
- **Pre-existing live sessions on first ship:** sessions already running when the feature ships have no stamp; the same fallback stamps them on first render. They appear in **By Project** immediately — **no "restart to appear" gap**.

So deriving the directory live from the pane's `current_path` is **not rejected** — it is precisely this fallback, used only for the un-stamped minority (typically still sitting at their project directory), then cached via the lazy stamp. The drift/perf objections applied only to using live derivation as the *primary* path, which v1 does not.

**Failure & ordering semantics (the fallback writes during a render):**

- **The derived value is used for *this* render**, not just cached for the next one — that is what makes "they appear in By Project immediately" true. The stamp write is a side-effect that accelerates *subsequent* renders.
- **The stamp write is best-effort.** If `set-session-option` fails (tmux error, session killed mid-render), the session still renders this pass using the in-memory derived directory; the stamp is simply re-attempted on the next grouped render. A write failure never drops the session from the view.
- **If git-root derivation itself fails** (pane has no enclosing git repository), the session is not stamped and falls to the **Unknown** bucket (By Project) / **Untagged** (By Tag) — see *Empty States*. It is re-attempted each render (cheap; this is the rare case).
- **First-ship cost is a bounded one-time amortisation.** On first ship every live session is un-stamped, so the *first* grouped render performs N git-root derivations + N stamp writes (N = live session count, ~15–20). This one-time cost is accepted; from the second render on, all sessions are on the fast path. The steady-state "un-stamped minority" framing applies after this first pass.

### Path-keying canonicalisation (build-time requirement)

The dir→tags lookup keys on a directory path, so the **render-time lookup key must match the stored `Project.Path` exactly**. Both the stamped `@portal-dir` value and the fallback-derived git-root must be normalised to the same canonical form the project store uses, accounting for: symlinks, trailing slash, `~` expansion. Implementation must confirm the lookup key matches stored `Project.Path` for the same directory; a mismatch would silently drop a session out of its group.

## Grouping Semantics

### Modes

The session list cycles through three modes:

1. **Flat** — today's list, unchanged: all live sessions, flat, alphabetical.
2. **By Project** — a heading per directory; each session appears **once** under its directory.
3. **By Tag** — a heading per tag; a session appears **under each tag it has**; untagged sessions fall to a pinned **Untagged** bucket.

### The grouping-key problem (multi-membership)

A directory can carry multiple tags, so a session can belong to multiple tag groups. How a session renders depends on whether the grouping dimension is single- or multi-valued:

- **By Project — single-valued → Pattern A.** A session has exactly one directory, so it appears **once**. Matches the user's mental model and is the expected dominant mode.
- **By Tag — multi-valued → Pattern B.** A session appears **once under each tag it has** (the Linear/Jira/Trello/Notion group-by-label convention). This deliberately avoids inventing a "primary tag" concept — the only alternative, judged not worth the extra model and UX. Rendering: a multi-tag session is materialised as one list item per tag (see *Filter Composition → Item model*); every instance attaches the same underlying session.

**Untagged bucket.** In By Tag mode, sessions whose directory has no tags collect under a single **Untagged** group, pinned last.

**Catch-all bucket rendering.** The pinned **Untagged** (By Tag) and **Unknown** (By Project) buckets are ordinary group headers: they **carry a count** like any other heading (e.g. `Untagged ··· 3`), and they are **rendered only when their membership is ≥ 1**. An empty catch-all is **suppressed** — when tags exist but every live session is tagged, no `Untagged` header appears; likewise no `Unknown` header when every session resolves to a known project. (This is distinct from the globally-empty By-Tag *zero-tags-anywhere* case, which shows the "No tags yet" signpost.)

**Heading label text.**

- **By Project headings show the project `name`** (the friendly name on the `Project` record), e.g. `Portal`. The **grouping key is the canonical directory path**, not the name — so two distinct directories that happen to share a `name` (e.g. `~/code/portal` and `~/archive/portal`) form **two separate groups** that may display the same heading text. This visual repeat is accepted in v1 (no path-disambiguation suffix); it is rare and harmless. (A session whose directory is not a known project — stamped path with no matching `Project` record — does not appear here; see *Empty States → Unknown bucket*.)
- **By Tag headings show the canonical (trimmed, lower-cased) tag value.**

Accepted downside of Pattern B: a heavily-tagged list is longer than the flat list (sessions repeat). Mitigations beyond the Untagged catch-all (e.g. collapsible headers) are **deferred** — not built up front, revisited only if it bites.

### Ordering — static alphabetical, no recency

Portal has no recency tracking and does not hook zoxide frecency into this view. Ordering is static:

- **Within a group:** alphabetical by session name.
- **Group headings:** alphabetical.
- **Catch-all buckets pinned last** (overrides alphabetical): **Untagged** in By Tag mode, **Unknown** in By Project mode.

This matches today's static flat-list ordering, just aggregated. An MRU/recency ordering was explicitly declined.

## TUI Rendering & Toggle Behaviour

### Toggle key — `s`, single cycle

A single key **cycles** the mode: each press advances **Flat → By Project → By Tag → Flat**. A cycle is chosen over a "group by" menu because there are only three modes (fewer keystrokes, less chrome).

**The cycle is unconditional — By Tag is never skipped.** Even when zero tags exist anywhere, the cycle still includes By Tag; landing on it shows the "No tags yet" signposted state (see *Empty States*) rather than being skipped. Rationale: a predictable fixed cycle beats a count-dependent one that silently changes which mode a press lands on. For cycling purposes the signposted state **is** the By-Tag mode (the persisted mode is `by-tag`); one `s` press from there advances to Flat as normal. The same holds if Portal reopens in a persisted By-Tag mode with zero tags — it shows the signpost, and the cycle behaves identically.

**The cycle is also unconditional on session count.** `s` cycles modes and writes the new mode to `prefs.json` regardless of how many sessions are live — including **zero** live sessions. The toggle is never gated on a non-empty list; an empty list simply renders the empty/degenerate state for whichever mode is active. (Same principle as unconditional-on-tag-count.)

The toggle key is **`s`** ("switch view"), on the sessions page:

- Verified free on the sessions page — the browse-mode handler (`model.go:1583-1607`) handles only `? q k r n p x`, space, enter, esc; everything else falls through to the `bubbles/list`, which does not bind `s`.
- `g`/`G` were ruled out — they are bound by `bubbles/list` to GoToStart/GoToEnd (`model.go:635-636`).
- Minor accepted wrinkle: `s` already means "go to sessions" on the *projects* page (`s`/`x`). Same letter, page-dependent meaning — judged fine; it chains naturally (on projects, `s` → sessions; press `s` again → cycle views), and `x` remains the universal page-toggle.

**`s` while the `/` filter input is active.** When the filter input is focused and capturing keystrokes, `s` is a **literal filter character** (typed into the search text) — exactly as in browse-mode today, where rune keys are consumed by the filter while it has focus. `s` does **not** cycle the mode mid-typing. To switch modes the user exits/clears the filter first (at which point the grouped view restores per *Flatten-on-filter*) and then presses `s`. This matches the established precedence: the filter owns keystrokes while focused; `s` cycles only in browse mode.

### Group headers

Group headers are:

- **Dimmed** (styled distinct from session rows).
- **Non-selectable** — the cursor jumps session-to-session and **never lands on a header**. This is achieved by the **render-layer approach** (see *Filter Composition → Build note*): the list's items remain *session items only*; headings are injected at render time as visual separators, not as list rows. Because headers are never list items, the cursor cannot land on one and no custom skip logic is required. Consequences:
  - **Initial cursor:** the first **session** row (the leading header is purely visual).
  - **GoToStart / GoToEnd (`g`/`G`, bound by `bubbles/list`):** land on the first / last **session** — they navigate list items, which are all sessions.
  - **No conflict with flatten-on-filter:** since the built-in filter only ever sees session items, filtering and the non-selectable guarantee fall out of the same render-layer design (this is the approach the build note mandates — headers as render-layer separators, not list items).
- **Counted** — each header carries a count of the rows rendered **under that heading**, e.g. `Portal ··· 2`. In By Tag mode (Pattern B) a multi-tag session is counted under each of its tag headings, so the **sum of By-Tag header counts exceeds the live session count** — this is expected, each count reflects what is shown beneath it.

### Mode indication

- **Mode string lives in the title** (top), via the existing `SessionListTitle()`:
  - Flat → `Sessions`
  - By Project → `Sessions — by project`
  - By Tag → `Sessions — by tag`
- **Key hint lives in the footer** (Portal convention — keys at the bottom). Only the `s switch view` entry is added to the footer. The mode *state* lives in the title, off the crowded footer.

### Rendering stack

- **`bubbles/list`** drives the interactive picker (cursor, selection, filter, scroll, pagination) — unchanged.
- **`lipgloss`** styles the grouped look (dimmed headers + counts), layered into the existing `SessionDelegate` styles.

Both are already in use. The grouped appearance is achieved purely as lipgloss styling layered into `bubbles/list` rendering — **no new library, no rebuild.**

**`lipgloss/list` and `lipgloss/tree` were considered and rejected:** they are *static* renderers with no cursor/selection/filter/scroll; adopting them would mean hand-rolling all the interactivity `bubbles/list` provides for free. **Build constraint: the picker must not be routed through `lipgloss/tree`.**

## Mode Persistence & Empty States

### Remember last mode

The last-used grouping mode is **persisted** so Portal opens in the user's usual view ("if I always open in tag view I don't want to keep switching to it").

- **First-ever launch defaults to Flat** (zero surprise), and remembers thereafter.
- **Persistence target:** a small **prefs file** under `~/.config/portal/`, using the existing `configFilePath` + `AtomicWrite` pattern. UI state does not belong in domain stores like `projects.json`; the prefs file owns the last-used grouping mode. (This is an idiomatic implementation call, not a user-facing decision.)
- **Concrete shape (idiomatic, owned):**
  - **Filename:** `prefs.json`, resolved through `configFilePath` exactly like the other config files (per-file env-var override → `XDG_CONFIG_HOME/portal/` → `~/.config/portal/`). It participates in the same `migrateConfigFile` one-shot move convention as `projects.json` / `aliases` / `hooks.json`.
  - **Format & schema:** a JSON object with a single string-enum key, e.g. `{"session_list_mode": "flat" | "by-project" | "by-tag"}`. String enum (not int) so the file stays human-readable and stable.
  - **Write timing:** persisted on **each toggle press** via `AtomicWrite` (cheap; matches the "remember last mode" intent without a flush-on-quit code path). 
  - **Decode-failure behaviour:** a missing, empty, corrupt, or unparseable prefs file (or an unrecognised mode value) **falls back to Flat** and is treated as first-launch — consistent with the other stores' tolerant decode behaviour. No hard error; a missing file is the normal first-run state.

### Empty states

- **By Tag with zero tags** — does **not** silently flatten. Render the plain (ungrouped) session list **with an explicit "No tags yet" message**, so the user sees they are in tag view, understands why there are no groups, and knows where to add them (the projects page). This is a degrade-to-flat **with a signpost**, not a silent one — it preserves the no-regression feel (the session list itself is unchanged) while keeping the mode legible.
- **Empty tags field in the projects edit modal** — shows a clear empty state ("no tags") rather than a blank.
- **By Project with nothing to group** — follows the same no-regression principle as By Tag:
  - **No live sessions:** renders exactly as flat mode would (an empty list). There is nothing to group; By Project never renders worse than flat, so no dedicated signpost is required. Unlike By Tag (which can be globally empty whenever zero tags exist anywhere), By Project is effectively always populated once any session is live, because every session resolves to a directory (via the `@portal-dir` stamp or the lazy fallback).
  - **Unresolvable directory:** a session whose `@portal-dir` is absent *and* whose lazy fallback cannot derive a git-root (e.g. a pane with no enclosing git repository) collects under a single pinned **Unknown** group at the end — mirroring the By-Tag **Untagged** bucket — so no session is ever silently dropped from the grouped view.
  - **Stamped, but no matching project record** (e.g. the project was deleted from the projects page while a session stamped with its `@portal-dir` is still live): the path lookup misses. This routes the same way as an unresolvable directory:
    - **By Project:** the session falls to the **Unknown** bucket (the Unknown bucket covers *both* "no derivable directory" and "directory resolved but not a known project").
    - **By Tag:** no project record → no tags → the session falls to **Untagged**.
    - No attempt is made to synthesise a heading from the bare path; the deleted project's tags are gone (lifecycle), so the session simply behaves as an untagged/unknown session until it ends or its directory is re-opened (re-creating the project record).

## Filter Composition

The existing `/` fuzzy filter (`bubbles/list`) continues to work **unchanged**, matching **session names** as it does today.

### Flatten-on-filter (v1)

While a filter is active, the list **flattens** to the matching sessions using the existing built-in filter; **group headers step aside**. Clearing the filter **restores** the grouped view. There is **no behaviour change** to filtering as it works today.

### Why not keep groups live while filtering

Keeping group headers visible during filtering was the user's first preference but is deferred — the cost is concentrated here and disproportionate to the rest of the feature:

- `bubbles/list` is a **flat list widget** with no concept of sections/headers. Its default filter **re-ranks matches into a relevance-sorted flat list** (scored by contiguity, start-of-string, post-separator matches — best-first, not alphabetical), which scrambles any grouped layout. The widget cannot preserve a structure it does not know exists.
- Keeping groups live during filtering would therefore require **Portal to own the filter wholesale** (custom input state, matching via `internal/fuzzy`, live re-group per keystroke, cursor/pagination management, `InitialFilter` re-wiring) and inherit a large interaction matrix (filter active + view-switch / preview / external-kill refresh / inside-tmux exclusion). This is the single biggest build-cost and bug-risk item in the area — bigger than the tagging itself.
- The payoff is small and transient: the difference shows only while actively typing; groups return the instant the filter clears, and filtering is usually "find one session fast," where a flat ranked hit-list is fine.

Live-grouped filtering is **deferred as its own separate, purely-additive feature** (see Non-Goals); nothing in v1 locks it out.

### Filter scope

- Filter scope stays **name-based**. The *tag* dimension is served by the **By Tag** view mode, not by the filter.

### Build note

Grouping must be a **render-layer** concern: every `bubbles/list` item is a **session instance** (an item that selects/attaches a real session), and group headings are injected at render time as visual separators — **never as list items**. "Session instance" — not "exactly one item per session": see *Item model* below, where By Tag mode legitimately materialises a multi-tag session as several instances. The key invariant is that *no list item is a header*. This single decision delivers three properties for free: the built-in filter only ever sees session instances (flatten-on-filter is trivial), the cursor can never land on a header (non-selectable, no skip logic), and `g`/`G` navigate session-instance to session-instance. The alternative (headers as list items, suppressed while filtering) is **rejected** — it would require custom cursor-skip logic and filter-aware header injection.

#### Item model (the central rendering mechanism)

The flat item slice fed to `bubbles/list` is **pre-sorted into grouped order**, and headers are injected at each **group-key boundary** (when the current item's group key differs from the previous item's). The slice is deliberately *not* in default `bubbles/list` order — grouping order is a precondition the render layer establishes before handing the slice to the widget.

- **Flat & By Project:** **one item per session.** Each session has exactly one directory, so it occupies one position. (By Project items are pre-sorted by project heading, then session name.)
- **By Tag:** **one item per `(session, tag)` pair.** A session with tags `[work, personal]` materialises as **two** list items — one under each tag heading. This is exactly what makes Pattern B and the header-count rule (sum of By-Tag counts exceeds live session count) work. A zero-tag session contributes **one** item, pinned into the **Untagged** group; an unresolved session contributes one item in **Unknown** (By Project).
- **Selection/cursor contract:** every instance of a session is independently selectable, and **selecting any instance attaches the same underlying session** (the duplicate instances are views of one session, not distinct targets). `g`/`G` and the initial cursor land on a session instance; it is acceptable and expected that the same session is reachable from more than one cursor position in By Tag mode.

> Note: Portal's custom `SessionDelegate` means matched characters do **not** visually highlight today — the built-in filter ranks but does not highlight matches. v1 introduces no change here.

## Assigning & Managing Tags

### Surface — the projects edit modal

Tags are assigned and managed in the **existing projects edit modal**. A **Tags** field is added alongside Name and Aliases, behaving **exactly like the existing alias field** (`model.go:1427-1438`):

- Type a tag + **Enter** to add it.
- Highlight an entry + **`x`** to remove it.

This reuses an interaction the user already knows — zero new interaction to learn.

**Field navigation (three fields now: Name, Aliases, Tags).** The modal's current binary Tab toggle (`model.go:1391-1397`, Name ↔ Aliases) becomes a **three-way cycle**:

- **Focus order:** Name → Aliases → **Tags** → (wrap to Name). Tab advances; the Tags field is placed **visually after Aliases** (last in the modal).
- **Tab still cycles** — no new navigation key is introduced; the existing Tab handler is extended from a binary toggle to an N-way cycle over the three fields.
- **Enter is field-scoped (add), not confirm.** While the Tags (or Aliases) field is focused with non-empty input, Enter **adds the entry** — identical to the existing alias-field behaviour. Modal confirm/save continues to use its existing mechanism, unchanged. Adding the Tags field does not alter the add-vs-confirm disambiguation for the existing fields.

### Refresh contract — edits are visible on return to the sessions page

Tags are read **live** from `projects.json` at grouped-render time (no per-session tag cache). For just-edited tags to appear, the grouped view must re-read project records when the user returns. v1 contract:

- On the **projects-edit → sessions-page transition**, dispatch a **sessions-list refresh that re-resolves project records and re-groups** — mirroring the existing refresh dispatched on the preview-dismiss → sessions transition. After adding/removing a tag and returning to the sessions list, the change is reflected on the next render.
- No live cross-page reactivity beyond this is required — re-grouping on page re-entry (not a background watch on `projects.json`) is sufficient for v1.

### Projects page only — not the sessions row

Tags are edited **from the projects page only**, never from a session row. Since v1 tags the *directory*, a sessions-row action would really mean "edit this session's project" (indirect) — deferred to keep v1 clean. (This ties back to the deferred per-session tag layer.)

### TUI only — no CLI in v1

There is **no `portal tags …` CLI** in v1. The projects page is the sole management surface. A CLI/scripting interface is a possible later addition.

### Implicit tags (recap)

Consistent with the data model: there is no "create tag" step or registry. The set of tags is the union of tags applied across all projects (see *Tag Data Model & Persistence*). Applying `work` to a second directory auto-joins the existing `work` group.

## Acceptance Criteria

Verifiable behaviours to anchor planning and test cases. (Decisions and rationale live in the sections above; this is a checklist digest, not new scope.)

**Grouping & modes**

1. **Given** the sessions page (any session count, including zero), **when** the user presses `s` in browse mode, **then** the mode advances Flat → By Project → By Tag → Flat, the new mode is written to `prefs.json`, the title reflects the mode (`Sessions` / `Sessions — by project` / `Sessions — by tag`), and the footer shows the `s switch view` hint.
2. **Given** a project with tags `[work, personal]` and one live session in it, **when** in By Tag mode, **then** that session renders **under both** `work` and `personal` headings and under **no** Untagged group.
3. **Given** a session whose directory has no tags, **when** in By Tag mode, **then** it renders under the **Untagged** group, pinned last.
4. **Given** any sessions, **when** in By Project mode, **then** each session renders **exactly once** under its project `name` heading.
5. **Given** grouping is active, **then** group headers are dimmed, carry a count of the rows beneath them, and the cursor never lands on a header (`g`/`G` and initial cursor land on sessions).

**Tag values**

6. **Given** the projects edit modal, **when** the user adds `  Work `, **then** it is stored/displayed as `work`; adding `WORK` again is a no-op; pressing Enter on a blank input adds nothing.
7. **Given** two projects tagged `work` and `Work` respectively, **when** in By Tag mode, **then** their sessions appear under a **single** `work` heading.

**Resolution & buckets**

8. **Given** a newly created session, **then** `@portal-dir` is stamped at creation and By Project groups it without a `git rev-parse` at render.
9. **Given** a live session with no `@portal-dir` (post-reboot or pre-existing on first ship), **when** the grouped list first renders, **then** the session is resolved from its active pane → git-root, grouped **this render**, and stamped for subsequent renders.
10. **Given** a session whose directory cannot be resolved to a git-root, **or** a stamped session whose project record no longer exists, **then** it renders under **Unknown** (By Project) / **Untagged** (By Tag) and is never dropped.

**Persistence & empty states**

11. **Given** a first-ever launch (no `prefs.json`), **then** the list opens in Flat; **and** after toggling to By Tag and reopening, it opens in By Tag.
12. **Given** a corrupt/unparseable `prefs.json`, **then** the list opens in Flat (treated as first-launch), no hard error.
13. **Given** By Tag mode with zero tags anywhere, **then** the plain session list renders with a "No tags yet" signpost (not a silent flatten), and the cycle still includes By Tag.

**Filter**

14. **Given** grouping is active, **when** the user types in the `/` filter, **then** the list flattens to matching sessions (headers step aside); **when** the filter clears, **then** the grouped view restores. Filtering behaviour is otherwise unchanged from today.

**No-regression**

15. **Given** zero tags and Flat mode, **then** the session list is identical to today's (ordering, content, behaviour).

---

## Working Notes
