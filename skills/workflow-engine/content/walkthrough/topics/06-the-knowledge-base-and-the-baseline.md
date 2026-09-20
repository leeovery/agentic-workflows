# The knowledge base and the baseline

The knowledge base is the system's memory. As each piece of thinking work finishes, its document is added to a searchable store inside the project, and later sessions can find it by meaning rather than by exact words. What comes back is the actual sentence someone reasoned their way to, with a note of which piece of work, which phase and when.

It remembers the thinking: research, discussions, investigations and specifications, along with the early material a piece of work started from and the product roadmap's own sessions. It never indexes plans, code or review reports, because those describe how the work got done rather than what was learned or decided, and indexing them would bury every search in task numbers. Each remembered piece carries a confidence: a specification is high, an investigation medium, a discussion lower, research lowest. Low confidence is not low value; a research note that killed a bad approach is exactly what stops the next person exploring the same dead end.

You rarely go looking for it. During the thinking-heavy phases the system checks the memory on your behalf, at the start and whenever the conversation brushes ground that might have been covered before, and folds in the one or two things that bear on what you're doing. You can also just ask: "have we discussed this?", "what did we decide about X?" Older material fades as the project moves on, measured by how much later work has landed rather than by the calendar, and specifications never fade at all.

```
   remembered    research · discussions · investigations ·
                 specifications · the notes work started from
   never kept    plans · code · review reports
   fades         as later work lands, never by the calendar
   never fades   specifications
```

The knowledge base is switched on once per project, and that is the one moment you are asked to configure something by name: how it should search. Search by meaning needs an embedding provider; keyword-only needs nothing and can be upgraded any time.

A baseline is for a codebase that existed before the workflows did. Without one, the memory starts empty and every phase that leans on it fires blanks. The baseline reads the code, area by area, then interviews you in rounds for the intentions, history and constraints the code cannot show, and writes both up as documents the knowledge base surfaces in every later phase, marked as reference rather than decisions of record. It is offered once on a codebase with a history, it can be paused and resumed, and it is always available from the start menu's `a/baseline` row to view, expand or begin.
