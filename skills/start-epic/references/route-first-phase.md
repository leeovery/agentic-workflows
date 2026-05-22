# Route to First Phase

*Reference for **[start-epic](../SKILL.md)***

---

New epics route to inception. The only branch here is whether the user wants to import seed material first.

> *Output the next fenced block as markdown (not a code block):*

```
> Inception is a short conversational session that surfaces
> the topics this epic will cover and tags each as research
> or discussion. If you have existing notes or research files,
> you can import them first — they become the launchpad for
> the session.

· · · · · · · · · · · ·
How would you like to start?

- **`c`/`continue`** — Begin the inception session now
- **`i`/`import`** — Import existing files first, then begin inception

Select an option:
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chooses continue

→ Return to caller.

#### If user chooses import

Load **[collect-import.md](collect-import.md)** and follow its instructions as written.

→ Return to caller.
