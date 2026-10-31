# Moving Levels

*Reference for **[leeway-discovery](../SKILL.md)***

---

The conversation goes where the talk has gone, in this session: from the product's conversation into an epic whose map is still open, or from an epic's discovery out to the product. Say so in one line, re-read the log against the conversation and add what is missing, then move — `{to}` is the epic, or `product`:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs enter discovery {to} --move
```

A refusal names the way on: say it in a line and carry on where you are. Otherwise read the move's DATA as on entering: `{home}` is now `{to}`, and the conversation carries on there.
