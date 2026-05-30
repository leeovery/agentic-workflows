# Land Imports

*Reference for **[workflow-bootstrap](../SKILL.md)***

---

Move any files Discovery collected from staging into the work unit's `imports/` directory, register them in the manifest, and index them into the knowledge base. Reuses the shared **[import-files.md](../../workflow-shared/references/import-files.md)** reference for the per-file mechanics.

## A. Check for Staged Imports

#### If `imports_staging` is empty or absent

No imports to land — Discovery did not collect any.

→ Return to caller.

#### Otherwise

Verify the staging directory exists on disk. If it does not exist (Discovery indicated imports but they are missing), surface the error and stop:

```
Imports staging directory not found: {imports_staging}

Bootstrap cannot proceed without the staged imports. Re-enter via
/workflow-start to restart the work unit.
```

**STOP.** Do not proceed — terminal condition.

If the staging directory exists, list its files and capture the paths as `import_paths`.

→ Proceed to **B. Land Files**.

## B. Land Files

Hand off to the shared import-files reference. It validates paths, normalises filenames, copies each file into `.workflows/{work_unit}/imports/`, pushes a manifest entry per file, and indexes each file into the knowledge base.

→ Load **[import-files.md](../../workflow-shared/references/import-files.md)** with work_unit = `{work_unit}`, import_paths = `{import_paths}`.

When import-files returns:

→ Proceed to **C. Clean Staging**.

## C. Clean Staging

Remove the staging directory now that its contents have been landed:

```bash
rm -rf "{imports_staging}"
```

Commit the manifest writes and the imports directory:

```bash
git add .workflows/{work_unit}/manifest.json .workflows/{work_unit}/imports/
git commit -m "bootstrap({work_unit}): land {N} import(s)"
```

→ Return to caller.
