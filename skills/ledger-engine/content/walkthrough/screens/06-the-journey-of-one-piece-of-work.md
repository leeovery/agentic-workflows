# The journey of one piece of work

Whether it is a topic inside an epic or a feature on its own, a piece of work travels the same phases, and each builds on what the last one recorded. That is why Ledger can pick up cold: nothing downstream depends on remembering a session, only on the record.

A discussion argues the design through, one conversation per topic. Its map lists your questions and the calls Claude made, each with where it stands, and the calls made since you last looked come first, so you can overrule one when it's made rather than at the end. The topic is done when nothing of yours is open. If a decision would rest on a number nobody has measured, an experiment measures it first.

```sample discussion-map
```

The specification turns the decisions into the contract the build works from, every statement traced to a decision, and cuts it into phases. Ready to build is one screen: you approve the outline and the cut, and choose how the build runs. The build writes each phase's tasks as the phase starts; agents build them test-first, side by side, and a pair of reviewers reads each one until both pass. A review phase then holds the whole change to the specification, and finish waits for you.

```sample build-progress
```

A bugfix finds the cause in an investigation instead of a discussion, and proves the bug with a failing test before fixing it. A quick-fix skips straight to its fixes, each built and reviewed the same way, in one session.
