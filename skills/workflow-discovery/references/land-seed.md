# Land the Seed

*Reference for **[workflow-discovery](../SKILL.md)***

---

Land a promoted inbox item as the work unit's **seed**: normalise the filename, move the file out of `.inbox/` into `.workflows/{work_unit}/seeds/`, push a `manifest.seeds[]` entry, and index it into the knowledge base.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit's name. Always present.
- `seed_path` — path to the inbox file being promoted (`.workflows/.inbox/{folder}/{file}`). Always present and known to exist.
- `source` — the seed's provenance: `inbox:idea`, `inbox:bug`, or `inbox:quickfix`. Recorded verbatim on the manifest entry.

## A. Normalise the Filename

Derive a destination filename from the basename of `seed_path`:

1. Lowercase the basename.
2. Replace runs of whitespace and any non-alphanumeric character (other than `.` and `-`) with `-`.
3. Collapse repeated `-` and trim leading/trailing `-`.
4. Ensure the name ends with `.md`. If the original extension is missing or differs, append `.md`.
5. Reject a name that resolves to `.`, `..`, or begins with `.` (dotfile) — fall back to a safe `seed.md`.

The inbox basename is already dated (`YYYY-MM-DD--{slug}.md`); normalisation collapses the `--` separator, preserving the date prefix as provenance.

If the normalised name collides with a file already under `.workflows/{work_unit}/seeds/` (only possible once multiple seeds can be joined), suffix the stem with `-2`, `-3`, … until unique.

Hold the resulting `destination_filename` for the next section.

→ Proceed to **B. Move and Track**.

## B. Move and Track

Ensure the seeds directory exists, move the file in, and push a manifest entry. Generate a fresh ISO 8601 UTC timestamp at move time:

```bash
mkdir -p .workflows/{work_unit}/seeds/
mv {seed_path} .workflows/{work_unit}/seeds/<destination_filename>
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit} seeds '{"path":"seeds/<destination_filename>","source":"{source}","seeded_at":"<iso>"}'
```

Where `<iso>` is `date -u +%Y-%m-%dT%H:%M:%SZ` taken at move time.

→ Proceed to **C. Index into KB**.

## C. Index into KB

Index the seed so it surfaces via retrieval in this and every future phase:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{work_unit}/seeds/<destination_filename>
```

The CLI is idempotent — re-indexing replaces existing chunks for the same identity (`work_unit + seeds + <basename>`).

If indexing fails, surface the error to the user but do not abort — the move and manifest entry are already in place, and the user can re-run `knowledge index` later.

→ Return to caller.
