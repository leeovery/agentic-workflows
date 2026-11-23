# Researching the Code

*Reference for **[ledger-discovery](../SKILL.md)***

---

The person asked for the project's code to be read before the product's first conversation. The product researcher reads it, lands what it shows as findings on the ledger, and brings back what it leaves open. Brief it, then make the Agent call — its `subagent_type` the agent `brief` answers, its prompt the pointer alone:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brief product-researcher
```

Say in a line that you are reading the code first, and wait for its result. Once it is in, record the research done:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brownfield record completed
```

Its findings are among what discovery found of the product, `ledger product`; what it leaves open is the person's to talk through.
