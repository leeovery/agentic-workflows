# Import Files

*Reference for **[workflow-discovery](../SKILL.md)***

---

Validate user-supplied import paths, normalise filenames, copy each file into `.workflows/{work_unit}/imports/`, push a manifest entry per file, and index each file into the knowledge base. Imports are seed material — they remain on disk for the work unit's life and surface in future sessions via knowledge-base retrieval.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit's name. Always present.
- `import_paths` — list of file paths the user provided in the prior prompt. The list may be space- or newline-separated; the caller passes the parsed values.

## A. Validate Paths

Check that every path in `import_paths` exists on disk.

#### If any path is missing

Report the missing paths to the user and re-prompt for corrected values:

> *Output the next fenced block as markdown (not a code block):*

```
> One or more paths could not be found:
>   • {missing_path_1}
>   • {missing_path_2}

· · · · · · · · · · · ·
Provide the corrected file path(s):

- **Provide file paths** — one or more, space or newline separated
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Return to **A. Validate Paths**.

#### Otherwise

→ Proceed to **B. Normalise Filenames**.

## B. Normalise Filenames

For each validated path, derive a destination filename from its basename:

1. Lowercase the basename.
2. Replace runs of whitespace and any non-alphanumeric character (other than `.` and `-`) with `-`.
3. Collapse repeated `-` and trim leading/trailing `-`.
4. Ensure the name ends with `.md`. If the original extension is missing or differs, append `.md`.
5. Reject names that resolve to `.`, `..`, or begin with `.` (dotfile). Report the rejected source path and skip that file.

If the normalised name collides with a file already under `.workflows/{work_unit}/imports/` **or** with a destination filename chosen earlier in this same batch, suffix the stem with `-2`, `-3`, … until the name is unique. The batch check matters when the user provides the same source path twice in one prompt — without it, the second entry would silently overwrite the first. (Re-importing the same source path across separate runs is also permitted — see **C. Copy and Track**.)

Hold the resulting `(source_path, destination_filename)` pairs for the next section.

→ Proceed to **C. Copy and Track**.

## C. Copy and Track

Ensure the imports directory exists:

```bash
mkdir -p .workflows/{work_unit}/imports/
```

For each `(source_path, destination_filename)` pair, copy the file and push a manifest entry. Generate a fresh ISO 8601 UTC timestamp per file at copy time:

```bash
cp <source_path> .workflows/{work_unit}/imports/<destination_filename>
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit} imports '{"path":"imports/<destination_filename>","imported_at":"<iso>"}'
```

Where `<iso>` is `date -u +%Y-%m-%dT%H:%M:%SZ` taken at copy time. One timestamp per file.

Re-importing a file that already exists at the destination path is allowed — the `cp` overwrites and the KB index call in **D** replaces existing chunks for that identity. The manifest gains a second `imports[]` entry; that minor duplication is acceptable.

→ Proceed to **D. Index into KB**.

## D. Index into KB

For each copied file, invoke the knowledge CLI:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{work_unit}/imports/<destination_filename>
```

The CLI is idempotent — re-indexing replaces existing chunks for the same identity (`work_unit + imports + <basename>`).

If a single file fails to index, surface the error to the user but do not abort the loop — remaining files still need to be indexed and the copy + manifest entries are already in place. The user can re-run the import or invoke `knowledge index` manually later.

→ Return to caller.
