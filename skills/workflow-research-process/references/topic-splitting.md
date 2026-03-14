# Topic Splitting

*Reference for **[epic-session.md](epic-session.md)***

---

**Never decide for the user.** Even if the answer seems obvious, flag it and ask.

Threads in the current file could be their own research topics — they have different scopes, stakeholders, or timelines.

Offer to extract them:

> *Output the next fenced block as a code block:*

```
I've noticed distinct threads emerging that could be their own research topics:

  • {thread_1} — {brief description}
  • {thread_2} — {brief description}

Want to split these into separate research files?
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Split them out
- **`n`/`no`** — Keep everything together for now
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If yes

For each split topic:
1. Create `.workflows/{work_unit}/research/{topic}.md` using **[template.md](template.md)**
2. Move content verbatim from the source file — reword only for flow and readability, no summarisation
3. Remove the extracted content from the source file
4. Init manifest item for the new topic:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.research.{topic}
   ```

Commit after splitting.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which topic would you like to continue with?

@foreach(topic in available_topics)
**{N}. {topic:(titlecase)}** — {status:(in-progress)}
@endforeach

Select an option (enter number):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Return to **[epic-session.md](epic-session.md)** and resume the **Session Loop**.

#### If no

→ Return to **[epic-session.md](epic-session.md)** and resume the **Session Loop**.
