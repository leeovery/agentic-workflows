# Session Loop

*Reference for **[workflow-legacy-research-split](../SKILL.md)***

---

Process each name in `qualifying_sources` from **[detect-trigger.md](detect-trigger.md)** — one source file per iteration.

## A. Iterate

#### If `qualifying_sources` is empty

→ Return to caller.

#### Otherwise

Pop the next name. Set `current_source = name`.

→ Proceed to **B. Read Source and Map**.

## B. Read Source and Map

> *Output the next fenced block as a code block:*

```
── Processing {current_source} ──────────────────
```

Read `.workflows/{work_unit}/research/{current_source}.md` end-to-end.

Re-run discovery so the map reflects items written by any prior iteration in this session:

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
```

From the discovery output, set `existing_names = [item.name for item in discovery_map]`. Also read `dismissed` — names previously removed via refinement.

→ Proceed to **C. Identify Themes**.

## C. Identify Themes

> *Output the next fenced block as a code block:*

```
·· Identify Themes ······························
```

Read the source file in full and extract every distinct theme, concern, decision point, constraint, risk, or open question. Be exhaustive — content not captured here is lost. Group sub-themes into coherent domains (anti-pattern: one theme per system component; a coherent domain becomes one topic).

For each theme, propose:

- `kebab_name`
- `summary` — one line
- `description` — a paragraph or two from the source
- `routing` — `discussion` (well-explored, ready for discussion) or `research` (under-explored, needs more research)

Classify against `existing_names` and `current_source`:

- **`stays`** — `kebab_name` equals `current_source`
- **`merges`** — `kebab_name` matches another entry in `existing_names`
- **`creates`** — `kebab_name` matches nothing on the map

→ Proceed to **D. Propose to User**.

## D. Propose to User

→ Load **[propose-candidates.md](propose-candidates.md)** and follow its instructions as written. On return, either the user has approved a plan (stored as `approved_creates`, `approved_merges`, `approved_stays`) or abandoned this source (`abandoned = true`).

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

→ Proceed to **F. Loop or Exit**.

## F. Loop or Exit

→ Return to **A. Iterate**.
