# Collect Import Details

*Reference for **[start-feature](../SKILL.md)***

---

Gather the file paths to import. No topic naming needed — feature topic equals the work unit name.

## A. File Paths

> *Output the next fenced block as a code block:*

```
·· Collect File Paths ···························
```

> *Output the next fenced block as markdown (not a code block):*

```
> Provide the path(s) to the files you want to import.
> Content will be ingested verbatim — no summarization.

· · · · · · · · · · · ·
Which files should be imported?

- **Provide file paths** — one or more, space or newline separated
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Validate each path exists. If any are missing, report which ones and ask again.

Store the validated paths as `import_files`.

→ Return to caller.
