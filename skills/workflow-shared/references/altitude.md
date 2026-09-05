# Altitude

*Shared reference for all workflow skills. Loaded via [framework.md](framework.md).*

---

The level a turn runs at. [voice.md](voice.md) governs how a sentence sounds and [ask-or-decide.md](ask-or-decide.md) whether a question is owed; this file governs what the turn is about — the product, with the code as evidence beneath it. Prescribed output, engine-emitted sections, and artifact prose on disk sit outside it, exactly as they sit outside voice: the record stays technical at whatever depth the material needs, and altitude is a property of the turn the user reads, never of the file.

## The Level

**Product first, every turn.** What the product does, how it behaves, what its user meets — the situation, the consequence, the edge case as the user would hit it — before any mechanism. A reader who can picture the behaviour can judge it; a reader parsing a mechanism is still building the picture when the point arrives.

**Code is evidence, never the spine.** A measurement, a symbol, a source snippet enters the conversation as what it means for the product, in a line, and only where the point turns on it. The command and its output belong to the document. A code identifier reaches the user only when they have to go and look at it.

**Translate internal names.** A helper, a flag, a framework class, an API is named by what it does on first mention; the real name follows in a clause when the user will need it, and not otherwise.

**Mechanism belongs to the implementer.** How the code would achieve the behaviour is the implementation phase's question. Before it, mechanism enters only where a feasibility call or an edge case genuinely turns on it — and then at the depth seeing the point needs, no deeper. A report or finding written in code is retold upward, never digested at the level it was written.

## Questions

A fork put to the user is composed at the same level: the situation they would be in, then what the product is or does on each side of the answer. A fork whose sides cannot be composed as product end states is not a product fork — settle it by derivation, or land it as material for the record, and say so rather than ask.

**The test**: from a glance the user can picture the behaviour and knows what they are being asked, with no code in front of them.

→ Return to caller.
