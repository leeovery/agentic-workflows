# Inbox Working Set

## The Idea

Turn the inbox pickup step into a **working set**: select one or more captured items, see a summary of each, build and trim the set, then take the whole set into discovery in one move (`w`/`work`). The same surface adds an **archive lifecycle** — archive items out of the inbox, and from a dedicated archived view restore or permanently delete them.

Consolidates two earlier ideas — per-item inbox actions (#18) and multi-item seeding of discovery (#29). Both reshape the same menu, so they ship as one piece.

## Context

`skills/workflow-start/references/start-from-inbox.md` lists ideas/bugs/quick-fixes, takes a single number, and routes straight to discovery (`route-to-discovery.md` → `/workflow-discovery`) with one `inbox_seed`. There is no way to inspect an item before committing, act on several together, or discard one without editing files by hand.

The durable layer is already multi-seed-ready: `manifest.seeds[]` is an array, `land-seed.md` normalises and collision-suffixes for joined seeds, and the knowledge base indexes per file. Only the *flow* is single-seed — pick one → opener reads one → confirm-trigger lands one. `.archived/` is referenced only by a migration today; it has no live reader or writer.

## What I'd Change

Two-stage inbox interaction, plus an archived sub-view.

### Stage A — list + menu

Compact numbered list (as today), then a per-line menu. The number-select is a single range option — the list above is the display, so don't re-list every number (CONVENTIONS.md:308, single-source-of-truth exception):

```
●───────────────────────────────────────────────●
  Inbox
●───────────────────────────────────────────────●

  1. AC4 test hardening (idea, 2026-05-11)
  2. Login 500 on expired token (bug, 2026-05-18)
  3. Rename --foo flag (quick-fix, 2026-05-22)
```

```
· · · · · · · · · · · ·
- **`1`–`3`** — Select item(s) to work on (comma-separated for several)
- **`a`/`archived`** — View archived items (restore or delete)
- **`b`/`back`** — Return
· · · · · · · · · · · ·
```

### Stage B — working set

Selecting one or more items builds the working set. Render it as a tree with a synthesised summary beneath each item, following the discovery map's structure (`epic-display-and-menu.md:62-134`): a `•` end-cap glyph between the branch and the title, summary wrapped at 65 chars and aligned under the title, `│` continuous on non-last rows. Cap the summary at 3 lines + `…`; `v`/`view` shows the full text.

```
  Working Set (2 items) — actions apply to all of them

  ┌─ • AC4 test hardening (idea)
  │    Tighten AC4 coverage; current tests miss the retry
  │    path and flake intermittently under load.
  └─ • Login 500 on expired token (bug)
       API returns 500 instead of 401 when the auth token
       has expired; should surface a clean re-auth prompt.
```

```
· · · · · · · · · · · ·
- **`w`/`work`** — Proceed to discovery with this set
- **`a`/`add`** — Add another inbox item to the set
- **`d`/`drop`** — Drop item(s) from the set (keeps them in the inbox)
- **`r`/`archive`** — Archive the whole set out of the inbox
- **`v`/`view`** — View full content of the set
- **`b`/`back`** — Return to list
- **Ask** — Ask about the set
· · · · · · · · · · · ·
```

**Whole-set rule:** `w`/`work` and `r`/`archive` act on every item in the set. There is no per-action sub-selection — `d`/`drop` is the only narrowing tool. To act on one of several, drop the rest, act, then add them back.

- `w`/`work` → route the set into discovery.
- `a`/`add` → re-show the list, pick more, return with the set expanded.
- `d`/`drop` → remove item(s) from the set (stays in the inbox); prompts which if more than one.
- `r`/`archive` → archive the whole set out of the inbox.
- `v`/`view` → dump full content of every set item, return to the menu.
- `b`/`back` → return to the list.
- **Ask** → answer from file content, return to the menu.

### Routing to discovery (`w`/`work`)

- **One item:** today's behaviour — the folder pre-seeds work_type (bug → bugfix, quickfix → quick-fix, idea → none).
- **Several items (#29):** the opener reads all of them as combined seed material and sketches the shape across them; mixed folders → no pre-seed, discovery classifies from content; the confirm-trigger lands all seeds together (`land-seed.md` called per item, already collision-safe).

### Archive (`r`/`archive`)

Move each set item to `.workflows/.inbox/.archived/{type}/`, commit, show a confirmation block, return to the now-shorter list. No manifest or KB touch — inbox items are pre-pipeline.

```bash
type_dir="${item_path%/*}"            # .workflows/.inbox/ideas
type_name="${type_dir##*/}"           # ideas | bugs | quickfixes
mkdir -p .workflows/.inbox/.archived/${type_name}
mv "${item_path}" .workflows/.inbox/.archived/${type_name}/
```

### Archived sub-view (Stage A → `a`/`archived`)

Single-select (no multi-select here), Select → Action two-stage like `manage-work-unit.md`: list archived items → pick one → action menu.

```
· · · · · · · · · · · ·
Selected: AC4 test hardening (idea, archived 2026-05-30)

- **`v`/`view`** — View full content
- **`u`/`unarchive`** — Restore to the inbox
- **`d`/`delete`** — Permanently delete (removes the file from git)
- **`b`/`back`** — Return to the archived list
· · · · · · · · · · · ·
```

- `v`/`view` → full content → back.
- `u`/`unarchive` → move back to `.inbox/{type}/`, commit → back.
- `d`/`delete` → `git rm` + commit (gone from the repo). Irreversible, so it gets a `y`/`n` confirm (harness convention for hard-to-reverse actions). Everything else stays confirm-free, matching `manage`.

## Relevant Files

- `skills/workflow-start/references/start-from-inbox.md` — Stage A list + range menu; entry to the working set and the archived sub-view. Likely split into `inbox-working-set.md` and `inbox-archived.md` reference files.
- `skills/workflow-start/references/route-to-discovery.md` — accept a list of seeds, not a single `inbox_seed`.
- `skills/workflow-discovery/references/opener-pattern.md` — read N seeds as combined material (currently the single-file "If an inbox seed is present" branch).
- `skills/workflow-discovery/references/confirm-trigger.md` — land N seeds (loop `land-seed.md`), stage all `.inbox/` removals.
- `skills/workflow-discovery/references/land-seed.md` — already multi-ready; called once per seed, no change needed.
- `CONVENTIONS.md` — menu/option types (265-308), tree + gutter (166-213), `•` bullet (362-364).

## Implementation Notes

- **`.archived/` gains its full lifecycle here** — archive (decline), unarchive (recover), hard-delete (purge). The recover half was previously parked as deferred; it is in scope now, and these are its first live reader/writers.
- **Pre-pipeline = no bookkeeping.** Archive/unarchive/delete are pure file moves + commits — no manifest entry, no KB index (only seeds are indexed, at landing).
- **Conventions reused, not invented:** Select → Action menu (`manage-work-unit.md`); comma-separated multi-number input (`present-review.md:157`); tree + wrapped summary + `•` end-cap (`epic-display-and-menu.md:62-134`). The `•` end-cap is the codebase bullet and is *not* in the map's status vocabulary (`→ ◐ ✓ ○ ⊘`), so it reads as a neutral marker; it also fixes the indent (title shifts right by the icon width, summary aligns under the title for a structural reason).
- **Mixed-folder precedence:** any disagreement among selected items → no work_type pre-seed; discovery classifies from content.
- **Letter shorthands:** `r`/`archive` at Stage B uses the second-letter rule (`add` holds `a`). `a` does double duty across the two menus (`a`/`archived` at Stage A, `a`/`add` at Stage B) — fine, they are separate menus.
- **Summary cap:** wrap at 65, max 3 lines + `…`; `v`/`view` is the full-text escape hatch.
- **Cost:** the common single-item path gains one keystroke (select, then `w`) — accepted, matching `manage`'s select-then-act.
- **Commits:** `workflow(inbox): archive {slug}` / `restore {slug}` / `delete {slug}`.

## Type-Denoting Icons (Considered, Dropped)

A per-type glyph (idea/bug/quick-fix) instead of the uniform `•` was considered. Dropped: the type is already in the `(idea)`/`(bug)` label so a glyph duplicates it, the symbol choices would be arbitrary, and it would need its own Key block like the map's tier legend. Revisit only if the `(type)` text label is dropped in favour of icons-with-a-legend.
