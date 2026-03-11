# Feature Research Session

*Reference for **[technical-research](../SKILL.md)***

---

Focused, single-topic session. No splitting, no multi-file management.

Load **[session-loop.md](session-loop.md)** and follow its conversation process.

## Session Conclusion

When the topic feels well-explored or the user indicates they're done:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Conclude research and move forward
- **Comment** — Add context before concluding
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `comment`

Incorporate the user's context into the research file, commit, then re-present the sign-off prompt above.

#### If `yes`

→ Load **[conclude-research.md](conclude-research.md)** and follow its instructions as written.
