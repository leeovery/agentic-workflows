# Present Options

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Present everything discovered to help the user make an informed choice.

**Present the full state:**

> *Output the next fenced block as a code block:*

```
Discussion Overview

{N} research topics found. {M} existing discussions.

Research topics:

1. {theme_name}
   └─ Source: {filename}.md (lines {start}-{end})
   └─ Discussion: @if(has_discussion) {work_unit}/{topic} ({status:[in-progress|completed]}) @else (no discussion) @endif
   └─ "{summary}"

2. ...
```

If discussions exist that are NOT linked to a research topic, list them separately:

> *Output the next fenced block as a code block:*

```
Existing discussions:

  • {work_unit}/{topic} ({status:[in-progress|completed]}, {work_type:[epic|feature|bugfix]})
```

### Key/Legend

No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Discussion status:
    in-progress — discussion is ongoing
    completed   — discussion is done
```

**Then present the options based on what exists:**

#### If research and discussions exist

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to proceed?

- **`r`/`refresh`** — Force fresh research analysis
- From research — pick a topic number above (e.g., "1" or "research 1")
- Continue discussion — name one above (e.g., "continue {topic}")
- Fresh topic — describe what you want to discuss
· · · · · · · · · · · ·
```

#### If only research exists

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to proceed?

- **`r`/`refresh`** — Force fresh research analysis
- From research — pick a topic number above (e.g., "1" or "research 1")
- Fresh topic — describe what you want to discuss
· · · · · · · · · · · ·
```

#### If only discussions exist

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to proceed?

- Continue discussion — name one above (e.g., "continue {topic}")
- Fresh topic — describe what you want to discuss
· · · · · · · · · · · ·
```

**STOP.** Wait for user response before proceeding.
