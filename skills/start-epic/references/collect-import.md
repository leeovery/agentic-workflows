# Collect Import Details

*Reference for **[start-epic](../SKILL.md)***

---

Gather the file paths to import, then copy each into `.workflows/{work_unit}/imports/` and record it on the manifest's `imports[]` array. The inception session will read these as the conversation launchpad.

> *Output the next fenced block as a code block:*

```
·· Collect File Paths ···························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Provide the path(s) to the files you want to import.
> Content will be copied verbatim — no summarisation.

· · · · · · · · · · · ·
Which files should be imported?

- **Provide file paths** — one or more, space or newline separated
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Validate each path exists. If any are missing, report which ones and ask again.

Once all paths are valid, ensure the imports directory exists:

```bash
mkdir -p .workflows/{work_unit}/imports/
```

For each validated path, copy the file and record it on the manifest:

```bash
cp <path> .workflows/{work_unit}/imports/<basename>
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit} imports '{"path":"imports/<basename>","imported_at":"<iso>"}'
```

Where `<iso>` is the current UTC timestamp in ISO 8601 (`date -u +%Y-%m-%dT%H:%M:%SZ`). Use one timestamp per file, generated at copy time.

→ Return to caller.
