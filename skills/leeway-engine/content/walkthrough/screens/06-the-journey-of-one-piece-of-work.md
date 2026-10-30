# The journey of one piece of work

Whether it is a topic inside an epic or a feature on its own, a piece of work travels the same phases, and each phase ends by writing a document the next one is built from. That chain is the reason the system can pick up cold: nothing downstream depends on remembering a session, only on reading what it left.

Discovery is where the thinking happens. Research surveys the ground when there is ground to survey. A discussion argues the design through to conclusions, guided by a live map of what is settled and what is still open, and if a decision turns out to rest on a number nobody has measured, an experiment is designed, run and reported before the decision is taken. Definition turns those conclusions into a specification, the contract everything after it is built from, and breaks it into a plan of phases and tasks with acceptance criteria. Delivery is where agents take the tasks one at a time, writing the tests before the code, and a review at the end holds the finished work to the specification and says plainly whether the two match.

```table
── DISCOVERY
research | what is known and what is feasible, per topic
experiment | a number measured, when a decision rests on one
discussion | the design argued through to conclusions

── DEFINITION
specification | the contract everything after it is built from
planning | phases and tasks, each with acceptance criteria

── DELIVERY
implementation | the code, built test-first, one task at a time
review | the finished work held to the specification
```

A bugfix replaces the discussion with an investigation into why things broke, a quick-fix does the whole of Definition in one scoping pass, and a cross-cutting concern, being a standard rather than something to ship, ends at its specification. When a phase concludes, its document is indexed into the knowledge base, so later work can find what this one decided.
