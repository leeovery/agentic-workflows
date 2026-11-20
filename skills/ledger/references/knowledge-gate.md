# Knowledge Gate

*Reference for **[ledger](../SKILL.md)***

---

The knowledge base is required infrastructure: Ledger runs nothing until it is set up. The API key never passes through this chat: you never ask for it, accept it or echo it. If one appears in the conversation anyway, repeat, quote and store none of it; acknowledge it without echoing, say a key pasted into chat is exposed and should be rotated, and point to `knowledge setup --key-only` in their terminal.

Each note a setup prints on stderr is said in a sentence.

Where gate is `knowledge-adopt`, the project adopts this machine's configuration, asking nothing: run `node .claude/skills/ledger-engine/scripts/engine.cjs knowledge setup --from-system`, and carry on with the start. Where it refuses, carry on below.

Say the marker **`▪ Knowledge Base Setup`** on a line of its own, then work the screen `knowledge-gate` as the boot reference's **A Setup Screen** says.
