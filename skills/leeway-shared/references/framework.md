# Framework

*Shared reference for all workflow skills. Loaded at the head of the skill a conversation opens on, and re-loaded on context refresh.*

---

The framework is loaded once per conversation, by the skill the conversation opens on, and each load reads every file below; after a context refresh, the skill's recovery protocol re-loads it.

**If this conversation has already loaded the framework, with no context refresh since:**

The skill opened later carries on from that load.

→ Return to caller.

**Otherwise:**

→ Load **[instructions.md](instructions.md)** and follow its instructions as written.

→ Load **[casing-conventions.md](casing-conventions.md)** and follow its instructions as written.

→ Load **[voice.md](voice.md)** and follow its instructions as written.

→ Load **[altitude.md](altitude.md)** and follow its instructions as written.

→ Load **[ask-or-decide.md](ask-or-decide.md)** and follow its instructions as written.

→ Return to caller.
