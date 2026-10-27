# Discussion: Session Tagging and Grouping

## Context

Portal's `open` session list presents all live tmux sessions in flat
alphabetical order. The user routinely runs ~15–20 sessions at once; past a
certain count, a flat list stops being legible. The desire is to slice the list
different ways on demand and aggregate sessions into logical groups, flipping
between views with a toggle.

### Restated goal (session 001)

The user clarified that **tags were a candidate mechanism, not the goal**. The
actual want is: **a grouped session list with a toggle to switch between
grouping modes.** Mockup the user gave:

    Portal
      session-1
      session-2

    Agentic Workflows
      session-3
      session-4

    Tick
      ...

That example groups by project/directory. But the user also wants *other*
groupings — e.g. Personal, Work, BusinessA, BusinessB — which is what led to the
tags idea. Tags are still on the table but explicitly "open to ideas." So the
decision splits into two axes: **intrinsic groupings** (directory/project —
derivable for free from where a session lives) and **custom groupings**
(user-defined buckets that need some data behind them).

Discovery reframed an initial "three fixed grouping modes" idea (by directory,
by project, by custom buckets) toward a more general primitive: **tags**. Tag a
project and its sessions inherit that tag; optionally tag individual sessions
directly too. Grouping becomes "aggregate by tag", with directory/project
either derived facets or built-in tags over the same machinery.

The user confirmed this is **one cohesive feature** (work type: feature), not
several independently-shippable pieces — the tag model/persistence, the
project→session inheritance rule, the aggregated/grouped TUI view, and
assigning/managing tags only make sense delivered together.

### Code grounding (current state)

- A **project** is `{path, name, last_used}` in `~/.config/portal/projects.json`
  (persistent). A **session** is live tmux state `{name, windows, attached}`.
- A session name is `{project}-{nanoid}` at creation, but there is **no stored
  session→project link** — the only association is the name prefix convention.
- The `open` session list is live tmux sessions, flat alphabetical.

### Hard constraints surfaced early (session 001)

1. **Session names are NOT identity.** The user renames sessions freely to match
   what the session is doing. So we cannot use the session name — neither for
   identity nor for parsing the `{project}-` prefix to recover its origin. The
   name-prefix inheritance path is dead on arrival.
2. **Projects are rarely used; the real entry point is the directory.** The user
   normally starts via an alias (e.g. `xc portal`) which resolves through
   zoxide to a *directory*. Many sessions never touch a "project" record at all.
   This pushes the natural tag anchor toward the **directory**, not the project:
   a "project" is really just a named, tagged directory, and the directory is
   the one stable thing that survives renames and reboots.

### References

- Discovery session log: `.workflows/session-tagging-and-grouping/discovery/session-001.md`

## Discussion Map

### States

- **pending** (`○`) — identified but not yet explored
- **exploring** (`◐`) — actively being discussed
- **converging** (`→`) — narrowing toward a decision
- **decided** (`✓`) — decision reached with rationale documented

### Map

  Discussion Map — Session Tagging and Grouping (6 subtopics)

  ┌─ ✓ Custom-grouping mechanism: tags [decided]
  ├─ ✓ Anchor: hybrid — v1 ships directory/project layer ONLY [decided]
  ├─ ✓ Tag data model & persistence (projects.json + @portal-dir stamp) [decided]
  ├─ ✓ Grouping-key problem (A: dir once · B: tag under each) [decided]
  ├─ ✓ Grouped TUI rendering + toggle behaviour [decided]
  └─ ✓ Assigning & managing tags (projects-page editing) [decided]

---

*Subtopics are documented below as they reach `decided` or accumulate enough
exploration to capture.*

---

## Custom-grouping mechanism

### Context

What produces the custom groups (Personal / Work / BusinessA)? Intrinsic
groupings (by directory/project) are free — derivable from where a session
lives. Only the custom dimension needs a mechanism.

### Journey

User landed on **tags**: "group by a tag, sessions auto-sort." Path-based
grouping (e.g. `~/Code/fabric/*` all together) was considered and kept as an
idea but judged too inflexible as the *custom* mechanism ("which segment?",
"doesn't work across the whole list"). Resolution: **path/directory grouping is
the free *intrinsic* toggle mode; tags are the *custom* mechanism.** The user
gets path-style grouping anyway (as the dir/project mode) without it having to
carry the flexible custom case.

### Decision

Tags are the custom-grouping mechanism. Grouping = pick a tag dimension, sessions
cluster under it. Open sub-questions in their own subtopics: the **grouping key**
problem (multi-tag session → which group does it render under), and the data
model/persistence shape.

---

## Anchor: what grouping data attaches to

### Context

User stated tags "need to be session based." But sessions have no durable
identity in Portal, so "session-based + durable" is the expensive path. This
subtopic decides what a tag actually hangs off.

### Feasibility finding (verified in code, session 001)

- `sessions.json` (`internal/state/schema.go`) keys each saved session **by
  `Name`** — there is **no session id/UUID**. Resurrection recreates sessions
  by name.
- Therefore Portal has **no stable session identity** today. Within a server
  lifetime tmux's `session_id` (`$3`) survives renames but is reassigned on
  reboot; the name survives reboot (resurrection restores it) but the user
  mutates names by habit. Neither is a durable key.
- **Durable session-based tags** would require introducing a Portal-stamped
  session id and threading it through create → daemon capture (schema bump) →
  restore → tag store. Real infrastructure touching the resurrection engine.

### The key distinction (assignment UX vs storage anchor)

The examples the user named — Personal / Work / BusinessA — are
**directory-stable classifications**: a directory's "Work-ness" is a property of
the place/project, not of a transient session. You would essentially never tag
two sessions in the *same directory* differently along these axes.

So "session based" may mean **"I assign the tag from the session row"** (UX), not
**"the tag is stored against the session"** (anchor). If the directory is the
storage anchor:

- Tags survive renames and reboots **for free** (directories are immortal; we
  look up live by the session's directory).
- Inheritance is automatic (every session in the dir gets the dir's tags).
- No schema bump, no session-identity infra.
- Cost: can't put two same-directory sessions in different custom groups — which
  the named use cases never need.

Open question to the user: is there a real case where two sessions in the **same
directory** must land in **different** custom groups? If no → directory anchor
(cheap, durable). If yes → pay for session identity (schema + resurrection work).

A wrinkle to resolve if directory-anchored: a live session's "directory" is
fuzzy (panes roam). Candidate: derive from the active pane's `current_path`, or
stamp the creation dir once at session create.

### Correction (session 001): "there is no BusinessA directory"

The user clarified their custom groups are **not** encoded in the filesystem —
there is no `~/businessA/` folder; BusinessA projects are scattered across
arbitrary paths (`~/Code/portal`, `~/Code/fabric`, …). Consequences:

- **Path-derived grouping (option C) is dead** — there is no shared path segment
  to group on.
- **Directory-anchored tags still work** — and this is the subtle point: a
  directory anchor does **not** require dirs to share a path. You tag each
  scattered directory `businessA` individually; they then group together
  regardless of where they live on disk. Directory-anchor ≠ path-derived.

### New option: tag at the tmux level (session user-option)

User asked: "can't we tag the tmux session somehow, at the tmux level?" Yes —
tmux **session user-options** (`@`-prefixed), which Portal already uses heavily
(`@portal-restoring`, `@portal-skeleton-*`). Store tags as e.g.
`@portal-tags "work,businessA"` on the session via the existing
`SetSessionOption` helper. Read them cheaply in one pass — `ListSessions`
already runs `list-sessions -F "#{session_name}|…"`; append `|#{@portal-tags}`
to read names+tags together for the grouped render.

Properties:

- **Genuinely per-session** and **survives rename** — the option attaches to the
  tmux session *object*, not its name. This sidesteps the mutable-name problem
  *and* the fuzzy-directory wrinkle (F2) entirely — no directory derivation
  needed.
- **The catch — reboot.** tmux options are in-memory server state; they die when
  the server dies. `sessions.json` currently saves `Session.Environment` but
  **not** session options. So to survive a reboot we must **capture
  `@portal-tags` into `sessions.json` and re-apply on restore** — a *modest,
  bounded* schema addition (add tags to the `Session` record; daemon reads the
  option on capture; restore re-sets it). Critically this is **far cheaper than
  inventing a session UUID** — tags travel *with* the session record that
  resurrection already keys by name, so no new identity scheme is needed.

### The fork (anchor), restated

1. **Directory-anchored** — store `{dir: [tags]}` in a json file. Tag once per
   place; every session there inherits. Zero resurrection change. Cost: can't
   distinguish two sessions in the same dir; assigning from one session row
   affects siblings in that dir.
2. **Session-option (`@portal-tags`)** — per-session granularity, survives
   rename, no directory derivation. Cost: tag each session individually; needs
   the modest capture/restore addition for reboot durability.
3. **Hybrid (matches original discovery framing)** — directory tags as the
   inherited base + per-session `@portal-tags` overrides for exceptions.
   Effective tags = dir ∪ session. Most flexible; most surface.

Leaning question to user: tag **once per place** (dir-anchored, ergonomic for
stable classifications), or tag **each session** (session-option, maximal
control)? YAGNI check on the hybrid before committing to both layers.

### Decision — hybrid, both layers

User chose **both**, explicitly. Two layers compose:

1. **Directory / project tags (inherited base).** Tag a directory once; every
   session started there inherits its tags. Key unification from the user:
   **"projects are just stored directories"** — so a *project tag* and a
   *directory tag* are the same concept. A project is a directory that also has a
   friendly name. Inheritance is a live lookup, durable for free (directories are
   immortal), no resurrection changes.
2. **Per-session tags (tmux `@portal-tags` option).** Set on the session object,
   survives rename, captured into `sessions.json` for reboot durability (the
   modest schema/capture/restore addition described above). Settable **at launch**
   via a new flag: **`portal open --tag=tag1,tag2`** (and presumably `x --tag=`),
   which stamps `@portal-tags` on the new session.

**Effective tags of a session = directory/project tags ∪ session tags** (union).
Whether a session tag can *subtract* an inherited tag is deferred as YAGNI —
union-only unless a real need surfaces.

### v1 scope cut (session 001) — directory/project layer only

User scoped a **first slice**: ship the **directory/project tag layer only**;
**defer** the per-session `@portal-tags` layer and `portal open --tag=`. Rationale:
"we're essentially tagging projects" — see how far pure directory tagging gets
before adding per-session ceremony. The hybrid remains the eventual shape; v1 is
just the inherited base of it. Effective tags in v1 = the directory's tags (no
union, no overrides).

### Parked sub-questions (to the data-model subtopic)

- **Where do directory tags live?** Natural fit: extend the `projects.json`
  `Project` record (`{path, name, last_used}`) with `tags []string`. But the
  user rarely creates projects — so does **tagging a bare (non-project) directory
  lazily create a project record**, or do directory tags need a store decoupled
  from projects? (Review F8 also flags path-keying sharp edges: symlinks,
  trailing slash, `~` expansion, canonicalisation.)
- **Reboot capture/restore** details for `@portal-tags` (schema bump, daemon
  capture, restore re-set). Interaction with `@portal-restoring` window (F4).
- **Grouping key** for multi-tag sessions (F1) — its own subtopic.

## Tag data model & persistence

### Context

Where do directory tags live, and how does a live session resolve to its
directory so it can be grouped / inherit tags?

### Confirmed code facts (session 001)

- `session.PrepareSession` (`internal/session/prepare.go`) resolves the input
  path to a **git root** (`git.Resolve`), derives `projectName =
  filepath.Base(resolvedDir)`, and **upserts a project on every session
  creation** (`store.Upsert(resolvedDir, projectName, "internal")`). Every Portal
  session creates/refreshes a project keyed by its git-root path.
- Validates the user's model: **projects are just stored git-root directories**;
  "start a session from a project" ≈ `cd <dir>` + start Portal.

### Direction

- **Store:** extend the `projects.json` `Project` record (`{path, name,
  last_used}`) with **`tags []string`**. A directory carries **multiple tags**
  (what lets one project appear under several tag groups). Reuses the existing
  JSON store + `AtomicWrite` + `configFilePath` machinery.
- **Editing UX:** surface tag editing on the **projects page** (already supports
  per-project editing / aliases). Detail deferred to the UX subtopic.

### The session→directory resolution problem (the one real piece of work)

Grouping *by project* (let alone by tag) requires mapping each **live** session
back to its directory. The name can't do it (`{project}-{nanoid}` at birth, but
the user renames). A session knows its directory only via its panes.

**Decision (user-confirmed): stamp `@portal-dir = <resolvedDir>` on the session
at creation** (value already in hand in `PrepareSession`). The grouped render
reads it in the same `list-sessions -F` pass and looks up the directory's tags.

- Survives **rename** (option rides the session object, not the name).
- Survives **pane `cd`** (stamped once at create, not derived from live cwd).
- Avoids `git rev-parse` per session per render (perf).
**Stamp-absence handling — decided: lazy stamp-on-render fallback (set-002
F1 + F3).** The stamp is the *fast path*. When a session has **no
`@portal-dir`**, the grouped render resolves its directory from the **active
pane's current path → git-root** and **stamps it then** (lazy). After that first
render the session is on the fast path. One mechanism covers **both** stamp-
absence cases — no schema change, no restore-engine change, no first-boot
backfill:

- **Post-reboot** (F1): restored sessions return without the option (it's not in
  `sessions.json`); first grouped render re-derives + re-stamps. No need to
  persist the resolved dir into the session record.
- **Pre-existing live sessions on first ship** (F3): sessions already running
  when the feature ships have no stamp; same fallback stamps them on first
  render — they appear in By Project immediately, **no "restart to appear" gap**.

So "derive live from pane `current_path`" is **not rejected** — it's exactly the
*fallback*, used only when the stamp is absent (the un-stamped minority,
typically still at their project dir), then cached via the lazy stamp. The
drift/perf objections applied only to using it as the *primary* path, which we
don't.

F3(b) — existing `projects.json` records predate the `tags` field — is a
non-issue: a missing `tags` field decodes to nil/empty (no tags), exactly the
zero-tag state.

### Open (parked)

- Path-keying sharp edges for the dir→tags lookup: symlinks, trailing slash, `~`
  expansion, canonicalisation (review F8). Confirm the render-time lookup key
  matches stored `Project.Path` exactly.
- **Decided (set-002 F2): no bare-directory tagging in v1.** The projects edit
  modal is the *only* origin for tags, and it lists known projects only. Since
  every session creation upserts a project, any directory opened in Portal at
  least once is taggable; a directory **never opened in Portal** is not a project
  and cannot be pre-tagged. Accepted boundary — open a dir, then tag it.

## Grouping-key problem (multi-tag → which group)

### Context

A directory can have multiple tags, so a session can belong to multiple tag
groups. When grouping is active, does a multi-tag session appear once or under
each tag?

### Direction (converging — standard-practice split)

- **Group by project/directory** is single-valued → **Pattern A**: each session
  appears **once**. Matches the user's mockup; expected dominant mode.
- **Group by tag** is multi-valued → **Pattern B** (Linear/Jira/Trello/Notion
  group-by-label convention): a session appears **under each tag it has**. Avoids
  inventing a "primary tag" concept (the only alternative, judged not worth the
  extra model + UX).

Honest downside of B: a heavily-tagged list grows longer than flat. Mitigations
deferred unless they bite: an "Untagged" catch-all, collapsible headers — not
built up front (review F7).

**Decided** — user confirmed via the mockups ("exactly what I had in mind"),
including the By-Tag mockup showing a session under two tags + the Untagged
bucket.

## Grouped TUI rendering + toggle behaviour

### Decided (user-confirmed via mockups)

- **Modes:** the list cycles through **Flat → By Project → By Tag**. User
  confirmed all three; the mockups matched their mental picture exactly.
  - *By project*: heading per directory, each session appears **once**.
  - *By tag*: heading per tag, a session appears **under each of its tags**
    (Pattern B); untagged sessions fall to a pinned **Untagged** bucket.
- **Header style:** group headers are **dimmed**, **non-selectable** (cursor
  jumps session-to-session, never lands on a header), and carry a **count**
  (e.g. `Portal ··· 2`). User: "that's perfect."

### Decided (cont.)

- **Toggle = single cycle key.** Each press advances Flat → Project → Tag →
  Flat. A cycle beats a "group by" menu for only three modes (fewer keystrokes,
  less chrome). User happy with a cycle.
- **Remember last mode.** Persist the last-used grouping mode (in config) so
  Portal opens in the user's usual view — "if I always open in tag view I don't
  want to keep switching to it." First-ever launch defaults to **Flat** (zero
  surprise), remembers thereafter.
- **Discoverability** ("how the options show"): the footer keymap shows the
  toggle key + its action, and the footer shows the **current mode**
  (`grouped: project`). No separate menu needed — standard Portal footer-hint
  convention.
- **Ordering = static alphabetical (no recency).** Portal has **no recency
  tracking**; it leans on zoxide frecency for resolution but the user does not
  want to hook that in here. So: within a group, alphabetical by session name;
  group headings alphabetical; **Untagged pinned last**. Matches today's static
  flat-list ordering, just aggregated. (MRU/recency alternative explicitly
  declined.)
- **Filtering:** see *Filter composition* below — **v1 flattens on filter** (the
  built-in `/` filter is unchanged; grouping steps aside while filtering, returns
  on clear). (Earlier wording implying grouped filtering was superseded.)
- **Tag exclusion — deferred from v1** (user agreed). A filter layer on top of
  grouping; revisit only if a concrete "tag I never want to see" pain appears.
  `/` filter covers basic narrowing meanwhile.

### Decided — toggle key & mode-string placement

- **Toggle key: `s` ("switch view").** `g`/`G` were ruled out (bubbles/list
  GoToStart/GoToEnd, kept active at `model.go:635-636`). Verified `s` is **free
  on the sessions page** — the browse-mode handler (`model.go:1583-1607`) only
  handles `? q k r n p x`, space, enter, esc; everything else falls through to
  the list, which doesn't bind `s`.
  - Minor noted wrinkle: `s` already means "go to sessions" on the *projects*
    page (`s/x`). Same letter, page-dependent meaning. Judged fine — it chains
    naturally (on projects `s` → sessions; press `s` again → cycle views) and
    `x` remains the universal page-toggle.
- **Mode string in the title** (top), not the footer. Portal already owns
  `SessionListTitle()`. Flat → title is just `Sessions`; grouped →
  `Sessions — by project` / `Sessions — by tag`. Keeps the state glanceable and
  off the crowded footer.
- **Key hint stays in the footer** (Portal convention: keys live at the bottom).
  Only the `s switch view` entry is added there; the mode *state* lives in the
  title.

### Rendering stack (clarified)

Use **`bubbles/list`** for the interactive picker (cursor, selection, filter,
scroll, pagination) and **`lipgloss`** for styling the grouped look (dimmed
headers + counts, via the existing `SessionDelegate` styles). Both already in
use. **`lipgloss/list` and `lipgloss/tree` were considered** (they render nice
nested/grouped output) **and rejected**: they are *static* renderers with no
cursor/selection/filter/scroll — adopting them means hand-rolling all the
interactivity bubbles/list provides for free (the same big-lift trap as owning
the filter, but for the whole list). The grouped appearance is achievable purely
as lipgloss styling layered into bubbles/list rendering — no new library, no
rebuild. Build phase must not route the picker through `lipgloss/tree`.

### Remembered mode & empty states (decided, set-002 F4)

- **Persistence target:** a small **prefs file** under `~/.config/portal/` using
  the existing `configFilePath` + `AtomicWrite` pattern (domain stores like
  `projects.json` are not the home for UI state). Owns the last-used grouping
  mode. (Idiomatic call — not a user-facing decision.)
- **By Tag with zero tags:** does **not** silently flatten. Render the plain
  (ungrouped) session list **with an explicit "No tags yet" message** so the
  user sees they're in tag view and understands why there are no groups (and
  where to add them — the projects page). Effectively a degrade-to-flat *with a
  signpost*, not a silent one. Preserves the no-regression feel (the session list
  itself is unchanged) while keeping the mode legible.
- **Empty tags field** in the projects edit modal likewise shows a clear empty
  state ("no tags") rather than a blank.

### Filter composition

User asked: does `/` filter still work with the view modes? **Yes** — the
existing bubbles/list fuzzy filter is unchanged, matching **session names** as
today.

**Decided behaviour: flatten-on-filter (v1).** While a filter is active the list
flattens to matching sessions using the existing built-in filter; group headers
step aside; clearing the filter restores the grouped view. The built-in filter is
**unchanged** — no behaviour change to filtering as it works today.

**Why not "keep groups while filtering" in v1.** It was the user's first
preference, but explaining the impact showed the cost is concentrated entirely
here and is disproportionate to the rest of the feature:

- `bubbles/list` is a **flat list widget** — no concept of sections/headers.
  Grouping is entirely our own presentation layer on top. The widget's default
  filter **re-ranks matches into a relevance-sorted flat list** (scored against
  the typed query — contiguity, start-of-string, post-separator matches —
  sorted best-first, not alphabetical), which scrambles any grouped layout. The
  widget can't preserve a structure it doesn't know exists.
- Keeping groups live during filtering therefore means **Portal owns the filter
  wholesale** (custom input state, matching via `internal/fuzzy`, live re-group
  per keystroke, cursor/pagination management, `InitialFilter` re-wiring) and
  inherits a large interaction matrix (filter active + view-switch / preview /
  external-kill refresh / inside-tmux exclusion). This is the single biggest
  build-cost and bug-risk item in the feature — bigger than the tagging itself.
- The payoff is small and transient: the difference shows *only while actively
  typing a filter*; groups return the instant the filter clears, and filtering is
  usually "find one session fast," where a flat ranked hit-list is fine.

**Live-grouped-filtering is deferred as its own separate feature** — purely
additive later, nothing about v1 locks it out. (Correction logged: Portal's
custom `SessionDelegate` means matched chars do **not** highlight today — the
built-in filter ranks but does not visually highlight matches.)

Implementation note for build: grouping should be a **render-layer** concern (or
headers injected only when not filtering), so the built-in filter only ever sees
session items — keeps flatten-on-filter trivial.

- **Filter scope stays name-based.** The *tag* dimension is served by the By-Tag
  view mode, not the filter.

## Assigning & managing tags (projects-page editing)

### Decision (user-confirmed)

- **Edit in the existing projects edit modal.** Add a **Tags** field alongside
  Name and Aliases, behaving exactly like the alias field (`model.go:1427-1438`):
  type a tag + enter to add, highlight an entry + `x` to remove. Zero new
  interaction to learn.
- **Tags are implicit** — no separate "create tag" step or registry. The set of
  tags that exists = the union of tags applied across all projects. Applying
  `work` to a second directory auto-joins the existing `work` group.
- **TUI-only for v1** — no `portal tags …` CLI. Projects page is the management
  surface. CLI/scripting is a possible later add.
- **Edit from the projects page only** — not the sessions row. Since v1 tags the
  *directory*, a sessions-row action would really mean "edit this session's
  project" (indirect); deferred to keep v1 clean. (Ties back to the deferred
  per-session tag layer.)

### Lifecycle (review F9 — resolved as non-issue)

No orphan-tag problem in the directory model: tags live **on the project
record** in `projects.json`, not in a separate store. They persist with the
project and are removed when the project is deleted (projects-page `d`). The
`@portal-dir` session stamp is ephemeral and dies with the session — nothing to
GC. So no dedicated tag-cleanup sweep is needed (unlike hooks/markers).

## Summary

### Key Insights

1. **Tags were a means, not the goal.** The goal is a grouped session list with a
   toggle. Tags are how the *custom* grouping dimension is expressed.
2. **The directory is the durable anchor.** Session names are mutable (user
   renames freely) and projects are rarely used — but "projects are just stored
   git-root directories," and directories survive renames and reboots. So tags
   attach to directories; sessions inherit live.
3. **`@portal-dir` is the lynchpin.** Because names can't be identity, each
   session is stamped with its resolved git-root at creation (with a lazy
   stamp-on-render fallback for un-stamped sessions — post-reboot or
   pre-existing); the grouped render reads it to map session → directory → tags.
4. **Purely additive — no regression.** Flat mode and the zero-tag / all-tags-
   deleted state are exactly today's session list. Grouping appears only on
   opt-in (`s`). **By Project** delivers value with zero setup; **By Tag** fills
   in as the user tags.
5. **The biggest cost is filtering, not tagging.** "Keep groups while filtering"
   would mean Portal owning the whole filter (bubbles/list is a flat widget that
   re-ranks matches). Deferred — v1 flattens on filter.

### Open Threads

- **Live-grouped-filtering** (keep group headers while filtering) — deferred as
  its own separate feature; would require Portal to own the filter wholesale.
  Candidate future work unit.
- **Per-session tags + `portal open --tag=`** — deferred; the eventual hybrid's
  second layer. v1 ships directory/project tags only.
- **Tag exclusion / hide-a-tag** — deferred power-feature.
- Build-time detail still parked: dir→tag path-keying canonicalisation (review
  set-001 F8) — confirm render-time lookup key matches stored `Project.Path`.
- Resolved during final review: `@portal-dir` reboot re-stamp + first-ship
  pre-existing sessions → lazy stamp-on-render fallback (set-002 F1+F3); orphan
  tag cleanup → non-issue, tags ride the project record (set-001 F9).

### Current State

- **All 6 subtopics decided.** v1 scope = directory/project tag layer only.
- **Resolved:** tags as the custom-grouping mechanism; directory anchor (hybrid,
  v1 = dir layer); `projects.json` `tags []string` + `@portal-dir` stamp;
  grouping-key split (project once / tag under each); TUI (modes Flat→Project→Tag,
  `s` to switch, mode in title, dimmed counted unselectable headers, static
  alphabetical order, remember-last-mode); flatten-on-filter; assignment via the
  projects edit modal (implicit tags, TUI-only, projects-page only); additive /
  no-regression invariant.
- **Deferred (see Open Threads):** per-session tags + `--tag`, live-grouped
  filtering, tag exclusion. Only build-time detail still parked: dir→tag path
  canonicalisation. (`@portal-dir` reboot re-stamp + first-ship sessions were
  resolved via the lazy stamp-on-render fallback.)
