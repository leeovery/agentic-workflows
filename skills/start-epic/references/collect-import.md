# Collect Import Details

*Reference for **[start-epic](../SKILL.md)***

---

Gather the file paths to import and the topic name for this research.

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

→ Proceed to **B. Topic Name**.

---

## B. Topic Name

> *Output the next fenced block as a code block:*

```
·· Topic Name ···································
```

> *Output the next fenced block as markdown (not a code block):*

```
> The topic name becomes the research filename (kebab-case).
> Use "exploration" for broad, unfocused research.

· · · · · · · · · · · ·
What topic name should this research use?
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Convert the response to kebab-case. Store as `topic`. Resolve `resolved_filename = {topic}.md`.

→ Return to caller.
