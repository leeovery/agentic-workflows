# Display Options

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

## A. Display State and Menu

Present everything discovered to help the user make an informed choice.

**Present the full state.** Condense each topic's summary from the analysis cache into a single line (~80 chars max) — just enough to identify the topic's scope. The full analysis remains in the cache file unchanged.

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Discussion Overview
●───────────────────────────────────────────────●

{N} research topics found. {M} existing discussions.

Research topics:

1. {theme_name}
   ├─ Status: @if(has_discussion) [{status:[in-progress|completed]}] @else [pending] @endif
   ├─ Sources: {filename1}.md, {filename2}.md
   @if(has_discussion) ├─ Discussion: {work_unit}/{topic}
   @endif └─ {summary_condensed_to_one_line}

2. ...
```

If discussions exist that are NOT linked to a research topic, list them separately with continuing numbers:

> *Output the next fenced block as a code block:*

```
Existing discussions:

{N+1}. {topic:(titlecase)}
       ├─ Status: [{status:[in-progress|completed]}]
       └─ {work_type:[epic|feature|bugfix]} — {work_unit}

{N+2}. ...
```

If `gap_topics` from discovery has entries, show suggested topics from gap analysis after the existing discussions (numbered sequentially):

> *Output the next fenced block as a code block:*

```
Suggested topics (from gap analysis):

{N+M+1}. {topic_name:(titlecase)}
         ├─ Gap type: [{gap_type:[cross-discussion|elevated|emergent|integration|uncovered]}]
         ├─ Source discussions: {discussion1}.md, {discussion2}.md
         └─ {summary_condensed_to_one_line}

{N+M+2}. ...
```

Read the gap details from `.workflows/{work_unit}/.state/discussion-gap-analysis.md`. Condense each topic's summary into a single line (~80 chars max).

### Key/Legend

No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Status:
    in-progress — discussion is ongoing
    completed   — discussion is done
    pending     — identified by research, not yet discussed
    suggested   — identified by discussion gap analysis
```

**Then present the menu.** Numbered items match the overview (research topics first, then standalone discussions, then gap topics if any). Verb reflects status: pending → "Discuss", in-progress → "Continue", completed → "Reopen", suggested → "Discuss".

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to proceed?

- **`1`** — Discuss "Peer Networking" [pending]
- **`2`** — Continue "Auth Flow" [in-progress]
- **`3`** — Reopen "Bluetooth Switching" [completed]
@if(gap_topics exist)
- **`4`** — Discuss "Integration Testing" [suggested]
@endif

- **`f`/`fresh`** — Start a fresh topic not from research

@if(has_research or gap_topics exist)
- **`r`/`refresh`** — Force fresh analysis
@endif
@if(work_type == epic)
- **`b`/`back`** — Return to epic menu
@endif
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Route based on the user's choice.

#### If user chose a numbered topic or named a topic

Identify the selected topic from the numbered list (by number or name). Determine source from its status:
- pending → source="research"
- suggested → source="gap-analysis"
- in-progress or completed → source="continue"

→ Return to caller.

#### If user chose `fresh`

User wants to start a fresh discussion not derived from research.

Set source="fresh".

→ Return to caller.

#### If user chose `back`

Re-invoke the caller's entry-point skill to return to its menu. Invoke `/continue-epic {work_unit}`. This is terminal — the invoked skill takes over.

#### If user chose `refresh`

> *Output the next fenced block as a code block:*

```
Refreshing analysis...
```

Clear the cache metadata from the manifest and delete the cache files:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.research analysis_cache
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discussion gap_analysis_cache
rm .workflows/{work_unit}/.state/research-analysis.md
rm .workflows/{work_unit}/.state/discussion-gap-analysis.md
```

**If research exists (`state.has_research` is true):**

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

**If no research exists (gap analysis only):**

→ Return to **[the skill](../SKILL.md)** for **Step 5**.
