# Inbox Pickup Actions

## The Idea

After selecting an inbox item, show a per-item action menu offering promote / change-type / remove / back, with a natural-language prompt option for ad-hoc questions. Today picking a number routes straight to a start skill with no way to view, reclassify, or delete the item from the menu.

## Context

`skills/workflow-start/references/start-from-inbox.md` lists ideas/bugs/quick-fixes, accepts a number, and routes:

- bug → `/start-bugfix`
- quick-fix → `/start-quickfix`
- idea → small menu asking feature/epic/cross-cutting, then routes

Three gaps:

1. **Idea cannot promote to quick-fix.** The idea promote-menu omits `q`/`quick-fix`, even though an idea can turn out to be a trivially scoped mechanical change after capture. Today the user must delete the idea file and re-capture via `/workflow-log-quickfix`.

2. **No way to reclassify or remove items in-menu.** If an item was wrongly typed at capture (a bug logged as an idea, an idea that's actually a quick-fix), the only fix is editing or deleting the file by hand. There is no `t`/`type` or `r`/`remove` action.

3. **No way to inspect an item without promoting it.** To decide whether to promote, the user often wants to read the body, or ask "is #5 really an idea or a quick-fix?" Today that means cancelling out and opening the file manually.

## What I'd Change

Add a per-item action menu after picking a number from the inbox list. Follows the documented Mixed Prompt pattern (CONVENTIONS.md:268-277) — command options for discrete actions plus one prompt option for natural-language Q&A.

```
· · · · · · · · · · · ·
Selected: AC4 test hardening (idea, 2026-05-11)

- **`p`/`promote`** — Continue to pipeline
- **`t`/`type`** — Change classification (idea/quick-fix/bug)
- **`r`/`remove`** — Archive without promoting
- **`b`/`back`** — Return to list
- **Ask** — Ask about this item in natural language; the menu redisplays after the answer
· · · · · · · · · · · ·
```

### `p`/`promote`

- For ideas: existing routing menu, plus `q`/`quick-fix` added alongside feature/epic/cross-cutting.
- For bugs: route to `/start-bugfix` (current behaviour).
- For quick-fixes: route to `/start-quickfix` (current behaviour).

### `t`/`type`

Re-classifies the item permanently. Implementation:

```
mkdir -p .workflows/.inbox/{new-type}
mv .workflows/.inbox/{old-type}/{file} .workflows/.inbox/{new-type}/{file}
```

Three target types: `ideas/`, `quickfixes/`, `bugs/`. Sub-menu asks which.

### `r`/`remove`

Archive to `.workflows/.inbox/.archived/{type}/` — same pattern start-X skills use after promotion. Preserves history; reversible if user changes their mind.

### Natural-language prompt

User can ask "what's this about?", "is this really an idea?", "summarise it." Claude answers from the file content, then redisplays the menu. No new menu key — relies on the prompt option convention.

### Archive-source generalisation in start-quickfix

`skills/start-quickfix/references/name-check.md:75-76` hardcodes the archive source to `quickfixes/`. When an idea is promoted to quick-fix via the new `q` option, the source is `ideas/`. The archive step needs to honour the source directory.

Suggested form:

```bash
src_dir="${inbox_path%/*}"        # .workflows/.inbox/ideas or .../quickfixes
src_name="${src_dir##*/}"         # ideas | quickfixes
mkdir -p .workflows/.inbox/.archived/${src_name}
mv "${inbox_path}" .workflows/.inbox/.archived/${src_name}/
```

## Relevant Files

- `skills/workflow-start/references/start-from-inbox.md` — the inbox-pickup menu lives here
- `skills/start-quickfix/references/name-check.md:75-76` — hardcoded archive source path
- `CONVENTIONS.md:261-291` — option types, mixed prompt pattern, single-source-of-truth rule

## Implementation Notes

- The `t`/`type` move must preserve filename (date prefix + slug); only the parent directory changes.
- Consider whether `t` should also re-archive to the new type's `.archived/` bucket later, or whether the original `archived` location should match the type at archival time (currently — and after this change — it matches the type at archival time).
- Natural-language answers should stay short and never auto-promote on the user's behalf — the menu is always the next thing shown.
- The "menu redisplays after the answer" pattern is the same loop that `present-review.md` Q&A uses (`B. Q&A Loop` → return to itself). Pattern-match that.
