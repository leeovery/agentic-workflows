# The knowledge base

The knowledge base is Ledger's memory across pieces of work. Every question, finding and decision lands on the record as it is made, and each topic's current decisions are kept as a searchable record inside the project, so later sessions can find them by meaning rather than by matching words. What comes back is the actual decision someone reasoned their way to, with which piece of work it came from.

It remembers what is current. When a decision is replaced, the old answer drops out of search the moment the new one lands, so search never hands back something you have since changed your mind about. It keeps each topic's decisions, an investigation's root cause and fix, and a quick-fix's short record of what it changed. It never keeps a conversation's log, the specification or code: those describe how the work went rather than what was decided.

```
   remembered    each topic's current decisions ·
                 a bug's cause and fix · a quick-fix's record
   never kept    conversation logs · the specification · code
   replaced      drops out of search the moment it changes
```

You rarely go looking for it. At the start of a topic, and whenever the conversation brushes ground that might have been covered before, Claude checks it and folds in what bears on the work. You can also just ask: "have we discussed this?", "what did we decide about X?"

The knowledge base is switched on once in each copy of the project, the one moment you're asked to configure something by name: how it should search. Search by meaning needs an embedding provider; keyword-only needs nothing and can be upgraded any time. The store and that choice stay out of git, so a fresh clone asks again, and the store is rebuilt from the record.
