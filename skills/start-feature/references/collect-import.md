# Collect Import Details

*Reference for **[start-feature](../SKILL.md)***

---

Gather the file paths to import, then hand off to the shared import-files reference to copy each one into the work unit's `imports/` directory, register it in the manifest's `imports[]` list, and index it into the knowledge base. The research session opens fresh — imported content surfaces via knowledge base retrieval when relevant.

> *Output the next fenced block as a code block:*

```
·· Collect File Paths ···························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Provide the path(s) to the files you want to import.
> Files are copied verbatim and indexed into the knowledge base.

· · · · · · · · · · · ·
Which files should be imported?

- **Provide file paths** — one or more, space or newline separated
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Capture the paths from the user's response as `import_paths`.

→ Load **[import-files.md](../../workflow-shared/references/import-files.md)** with work_unit = `{work_unit}`, import_paths = `{import_paths}`.

→ Return to caller.
