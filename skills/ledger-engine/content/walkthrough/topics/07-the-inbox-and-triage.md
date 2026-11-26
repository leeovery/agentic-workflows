# The inbox and triage

Not every thought arrives ready to become a piece of work. Mid-way through building one thing you notice another that is broken, an idea worth exploring later, or a small change that ought to happen sometime. The inbox is where such thoughts wait, so you can keep working; triage is how you decide on them.

Claude keeps what comes up in any conversation, whether you asked or it came up in passing, and carries on with what you were doing. An idea, a bug or a fix for later goes into the inbox of the project it concerns, committed at once, with one line saying so; say "drop that" and it goes. A capture writes your thought down as you said it, never padded, so the thinking happens later, if you decide the thought is worth it. The rest has its places too: a view of the product or a direction you dropped goes into the product's conversation, a fact about the code becomes a finding, a file you share is kept among the product's files, and a point for a topic under way reaches it as a message. Two wait for your yes: the project's setup, how it builds, tests and runs, and an instruction for its `CLAUDE.md`.

```
   ideas        something you might build or explore
   bugs         something broken: symptoms, conditions, impact
   quick-fixes  work that takes no deciding: what, where
```

The start menu shows the inbox as one line, counted by kind, and `t/triage` opens it, each item with its age. Pick items by number, and Claude names others that fit with them; `c/change` adds to what's picked or takes some out. Then, for what's picked: `w/work` starts on it now as one piece of work, whose kind discovery settles from the items, whatever they mix; `r/roadmap` puts it on a horizon you name; `a/archive` takes it out of the inbox. Archived items are not gone: `v/view` lists them, to restore one to the inbox or delete it for good.

When a piece of work finishes, Claude checks the inbox against what was built, archives each item the work resolved as closed by it, and lists them in the finish report, so nothing is silently discarded and a wrong closure can be brought back.

Items a piece of work starts from are its seeds, the recorded reason it exists. A file you share with the work — notes, a design document, a screenshot, an error report — is kept with it as an asset. One is the spark and the other is fuel, and both are read early.
