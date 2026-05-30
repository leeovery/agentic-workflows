# Ensure Manifest

*Reference for **[workflow-bootstrap](../SKILL.md)***

---

Create the work-unit manifest if it does not already exist. On the menu-fast-paths (`e`/`f`/`b`/`q`/`c`), `/workflow-start` may have already created the manifest before Discovery ran. On the `s`/`start` ambiguous path, the manifest is created here — work_type was resolved during Discovery and is now bound.

## A. Check Existence

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}
```

`exists` returns exit 0 when the work unit's manifest is present, exit 2 (expected miss) when absent. Capture the exit code as `manifest_present`.

#### If `manifest_present` is `0`

The manifest already exists. Read its `work_type` and verify it matches the handoff:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} work_type
```

If the stored `work_type` differs from the handoff `work_type` (e.g. user accepted a pivot during Discovery), update it:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit} work_type {work_type}
```

→ Proceed to **B. Name Check** (no-op when manifest already exists).

#### Otherwise

The manifest does not exist. Create it.

→ Proceed to **B. Name Check**.

## B. Name Check

Load **[name-check.md](name-check.md)** with work_unit = `{work_unit}`, work_type = `{work_type}`, description = `{description}`.

When name-check returns, the manifest is guaranteed to exist with the expected `work_type` and `description`.

→ Return to caller.
