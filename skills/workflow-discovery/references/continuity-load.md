# Continuity Load

*Reference for **[workflow-discovery](../SKILL.md)***

---

On re-entry into an epic's discovery, the map is the digest; the session logs are the journey. Read both, so the session resumes a conversation rather than restarting from a topic list. The discovery output's `session_logs` lists every log (number + path) — read from it, don't re-glob.

Loaded by [session-loop.md](session-loop.md) A on the two re-entry branches (resume and populated-map), after the map (if any) is in context.

## A. Read Budget

Bounded regardless of how many sessions exist:

- **Map** — already in context. The populated-map branch rendered it; the resume branch may have none yet.
- **Recent in full** — read the most recent **2** session logs in full: their **Exploration**, **Edits**, and **Topics Identified**. On the resume branch the active log is the most recent and already loaded (re-reading is idempotent) — read the next concluded log below it.
- **Older — one-line index** — for every session older than the recent two, read **only its `## Conclusion` line** (the finalisation digest: topics added, edits applied, map size). One line each. This is the bound — older sessions never load their full Exploration.

**KB-on-demand.** Once discovery logs are knowledge-base indexed, an older session's full thinking can be pulled back by semantic query when a live thread calls for it. Until then, older sessions stay at the one-line Conclusion index, and recent-in-full is the floor — enough to resume on its own.

→ Proceed to **B. Briefing**.

## B. Briefing

Synthesise the recent-in-full logs into a short briefing that resumes the conversation — the threads being circled, what the user was leaning toward, what was left open. When the most recent log is an in-progress resume, note the edits already applied this session. Surface the *thinking*; don't restate the map.

> *Output the next fenced block as a code block:*

```
Where we'd got to:

  {2–4 lines from the recent session(s): the threads we were
  circling, what you were leaning toward, what was still open}

  {older sessions, if any: one line each from their Conclusion,
  under an "Earlier:" lead — only when it aids orientation}
```

The caller renders its own opener prompt and STOP after this briefing.

→ Return to caller.
