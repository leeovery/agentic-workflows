# The idea

Claude Code is a capable engineer with two gaps. It forgets everything between sessions, and it has no process for how a piece of work should unfold, so every session starts cold and improvises from there. The workflows fill both. Every piece of work goes through a phased process in which each phase produces a document the next phase is built from, and a knowledge base keeps those documents once the work is done, so nothing decided is decided twice.

```flow
a piece of work, described in your own words
↓
DISCOVERY | research · experiment · discussion
  → what was explored, what you decided, and why
↓
DEFINITION | specification · planning
  → the contract you approve, and the plan built from it
↓
DELIVERY | implementation · review
  → the code, built test-first by agents and held to your specification
↓
the knowledge base keeps every finished document, so the next piece of work starts from what this one decided
```

You are the engineer throughout. What to build, why, and what it must do are your decisions, made in the early phases where a wrong turn costs a sentence to correct, and everything downstream is built from them rather than from memory. The system's part is to argue back where it should, keep the record straight, build from the record, and check its own work against it.
