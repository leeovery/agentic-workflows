# Gather Context: Continue Discussion

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Gather Context`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Picking the discussion back up — a quick focus check before the session resumes.
```

Read the existing discussion document first, then ask:

> *Output the next fenced block as markdown (not a code block):*

```
Continuing: {topic}

I've read the existing discussion.

What would you like to focus on in this session?
```

**STOP.** Wait for user response.

Remember the response — it sets the focus for this continuation session.

→ Return to caller.
