# Researching the Code

*Reference for **[leeway-discovery](../SKILL.md)***

---

The project's code predates the workflows, and the person asked for it to be read: the product's conversation opens with that research. The product researcher reads the code, lands what it shows as findings on the ledger, and brings back what it leaves open. Brief it, then make the Agent call — its `subagent_type` the agent `brief` answers, its prompt the pointer alone:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief product-researcher
```

Say in a line that you are reading the code first, and wait for its result. Once it is in, record the research done:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brownfield record completed
```

Open the conversation from it: what the code shows, read from what discovery found of the product (`ledger product`, its `discovery` entries), and the questions it left open, which are the person's to talk through. Keep the three apart as the conversation goes:
- **What the code shows** is on the ledger already, and every topic opened later reads it. A further fact you read in the code lands the same way.
- **What the person says** — the intent, the history, the paths rejected, what a name means — is input, kept in the log.
- **What stays open** goes into the log as an open question; at the session's end, what still stands is proposed as roadmap items.
