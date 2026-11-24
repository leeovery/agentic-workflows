# Moving Up

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

Suggest going there in a line; only the person's word moves it. `{home}` is `{work_unit}` for an epic's discovery, or `product` for the product's conversation, the only place a single-topic unit's talk moves up to. Move, in this conversation:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs enter discovery {home} --move
```

Once it enters, invoke `/ledger-discovery none {work_unit}`, or `/ledger-discovery none none` for the product's conversation; the conversation carries on there.
