# Route Based on Scenario

*Reference for **[start-investigation](../SKILL.md)***

---

Use `state.scenario` from the discovery output to determine the path.

#### If scenario is `has_investigations`

> *Output the next fenced block as a code block:*

```
Investigations Overview

@if(investigations.counts.in_progress > 0)
In Progress:
@foreach(inv in investigations.files where status is in-progress)
  • {inv.topic}
@endforeach
@endif

@if(investigations.counts.concluded > 0)
Concluded:
@foreach(inv in investigations.files where status is concluded)
  • {inv.topic}
@endforeach
@endif
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

@if(in_progress investigations exist)
{N}. Resume "{topic}" investigation
@endforeach
@endif
{N}. Start new investigation
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `resuming`

Set source="continue".

→ Return to **[the skill](../SKILL.md)** for **Step 6** with that topic.

#### If `new`

Set source="fresh".

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

#### If scenario is `fresh`

Set source="fresh".

> *Output the next fenced block as a code block:*

```
No existing investigations found.
```

→ Return to **[the skill](../SKILL.md)** for **Step 5**.
