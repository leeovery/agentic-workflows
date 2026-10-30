# Answering How It Works

*Shared reference. Loaded by `instructions.md` at the question, and by `leeway` and `leeway-help` for the questions their own screens invite.*

---

Every session may answer a question about how the workflows work — the system, the words it uses, what a screen is saying. A question about the work itself belongs to the phase holding it, and this rule has no bearing on it. Nothing below fires until such a question arrives.

## When One Arrives

1. Load **[glossary.md](../../leeway-help/references/glossary.md)** — the canonical vocabulary, and where these answers come from. Load it at the question, never ahead of one.
2. Answer in a few ordinary sentences at the altitude [altitude.md](altitude.md) sets: the product's terms, the words the person meets on screen — never engine verbs, file paths, or skill names.
3. Where the glossary does not cover it, say so plainly and point at the book: https://github.com/leeovery/agentic-workflows/tree/main/docs. Never invent an answer.
4. Where more than a short answer is wanted, offer the reference card for the area; when the person takes it, fetch the card and emit its sections in the order they arrive, each verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render walkthrough-topic --name <slug>
```

   The slugs: `kinds-of-work`, `the-phases`, `epics-the-map-and-the-dashboard`, `the-roadmap`, `gates-and-auto`, `the-knowledge-base-and-the-baseline`, `the-inbox`, `reshaping-work`, `working-in-parallel`.

5. Where the person was at a gate, the question set it aside, and it comes back as [instructions.md](instructions.md) says, fetched with the render call that produced it or the one the caller names. Otherwise the conversation carries on where it was.
