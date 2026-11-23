# Answering How It Works

*Shared reference. Loaded by `framework.md` at the question.*

---

1. Load **[glossary.md](glossary.md)** — the canonical vocabulary, and where these answers come from. Load it at the question, never ahead of one.
2. Answer in the words the person meets on screen — never engine verbs, file paths, or skill names.
3. Where the glossary does not cover it, say so plainly and point at the book: https://github.com/leeovery/ledger/tree/main/docs. Never invent an answer.
4. Where more than a short answer is wanted, offer the reference card for the area. When the person takes it, fetch the card without its menu:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render walkthrough-topic --name {card:[kinds-of-work|the-phases|epics-the-map-and-the-menu|the-roadmap|gates-auto-and-step|the-knowledge-base|the-inbox-and-triage|reshaping-work|working-in-parallel]} --content-only
```

5. Where the person was at a gate, the question set it aside: it waits, taking their answer whenever it comes.
