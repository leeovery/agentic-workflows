# Session Loop

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Iterate over `qualifying_sources` from **[detect-trigger.md](detect-trigger.md)** and decompose each broad source file in turn. Each source file is a separate session within this skill.

## A. Iterate

#### If `qualifying_sources` is empty

→ Return to caller.

#### Otherwise

Pick the next `source` name from `qualifying_sources`. Set `current_source = source`. Remove it from `qualifying_sources` (it will be re-popped on the next iteration via this branch).

→ Proceed to **B. Read Source and Map**.

## B. Read Source and Map

> *Output the next fenced block as a code block:*

```
── Processing {current_source} ──────────────────
```

Read `.workflows/{work_unit}/research/{current_source}.md` end-to-end.

Re-run discovery for fresh map state (prior iterations may have written items):

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
```

Parse from discovery output:
- `discovery_map` — list of active topic items. Each entry has `name`.
- `dismissed` — array of names previously removed via refinement.

Set `existing_names = [item.name for item in discovery_map]`.

→ Proceed to **C. Identify Themes**.

## C. Identify Themes

> *Output the next fenced block as a code block:*

```
·· Identify Themes ······························
```

Read the source file's contents in full. Extract every distinct theme, concern, decision point, constraint, risk, or open question. Be exhaustive — anything not captured here is lost. Group related sub-themes (anti-pattern: one theme per system component; one topic per coherent domain).

For each theme, propose:
- `kebab_name` — a kebab-case topic name.
- `summary` — one-line summary covering the theme's content.
- `description` — a paragraph or two of richer context, drawn from the source material.
- `routing` — `discussion` (theme is well-explored, ready for direct discussion) or `research` (theme is under-explored, needs more research first). Judge based on the depth of source coverage.

For each theme, classify against `existing_names` and `current_source`:

- **`stays`** — `kebab_name` equals `current_source`. The theme keeps the same name as the source file. Default for the matching theme.
- **`merges`** — `kebab_name` equals some other entry in `existing_names`. The theme matches a different topic that already exists on the map; its content will be appended to that topic's research file.
- **`creates`** — `kebab_name` matches nothing in `existing_names` and does not equal `current_source`. Becomes a new topic.

Track each theme with its `classification` (`stays` | `merges` | `creates`).

→ Proceed to **D. Propose to User**.

## D. Propose to User

→ Load **[propose-candidates.md](propose-candidates.md)** and follow its instructions as written. On return, the user has either approved a set of themes (now stored as `approved_creates`, `approved_merges`, `approved_stays`) or abandoned this source file.

#### If user abandoned

> *Output the next fenced block as a code block:*

```
Skipping {current_source}. Source file and manifest unchanged.
```

→ Proceed to **F. Loop or Exit**.

#### Otherwise

→ Proceed to **E. Apply Split**.

## E. Apply Split

→ Load **[apply-split.md](apply-split.md)** and follow its instructions as written.

On return, the new research files exist, manifest items are written, KB entries are removed where needed, and a single commit has landed.

→ Proceed to **F. Loop or Exit**.

## F. Loop or Exit

→ Return to **A. Iterate**.
