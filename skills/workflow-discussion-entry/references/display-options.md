# Display Options

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

## A. Display State and Menu

Present everything discovered to help the user make an informed choice.

**Present the full state:**

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Discussion Overview
●───────────────────────────────────────────────●

{N} research topics found. {M} existing discussions.

Research topics:

1. {theme_name}
   └─ Sources: {filename1}.md, {filename2}.md
   └─ Discussion: @if(has_discussion) {work_unit}/{topic} ({status:[in-progress|completed]}) @else (pending from research) @endif
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
    in-progress           — discussion is ongoing
    completed             — discussion is done
    pending from research — identified by research, not yet discussed
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

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

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

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

#### If only discussions exist

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to proceed?

- Continue discussion — name one above (e.g., "continue {topic}")
- Fresh topic — describe what you want to discuss
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Route based on the user's choice.

#### If user chose `From research`

User chose to start from research (e.g., "research 1", "1", "from research", or a topic name).

Set source="research".

**If user specified a topic inline** (e.g., "research 2", "2", or topic name):
- Identify the selected topic from the numbered list

→ Return to caller.

**If user just said "from research" without specifying:**

> *Output the next fenced block as a code block:*

```
Which research topic would you like to discuss? (Enter a number or topic name)
```

**STOP.** Wait for user response.

→ Return to caller.

#### If user chose `Continue discussion`

User chose to continue a discussion (e.g., "continue auth-flow" or "continue discussion").

Set source="continue".

**If user specified a discussion inline** (e.g., "continue auth-flow"):
- Identify the selected discussion from the list

→ Return to caller.

**If user just said "continue discussion" without specifying:**

> *Output the next fenced block as a code block:*

```
Which discussion would you like to continue?
```

**STOP.** Wait for user response.

→ Return to caller.

#### If user chose `Fresh topic`

User wants to start a fresh discussion.

Set source="fresh".

→ Return to caller.

#### If user chose `refresh`

> *Output the next fenced block as a code block:*

```
Refreshing analysis...
```

Clear the cache metadata from the manifest and delete the cache file:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.research analysis_cache
rm .workflows/{work_unit}/.state/research-analysis.md
```

→ Return to **[the skill](../SKILL.md)** for **Step 4**.
