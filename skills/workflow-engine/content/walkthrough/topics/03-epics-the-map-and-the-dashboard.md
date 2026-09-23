# Epics: the map and the dashboard

An epic is a piece of work made of several distinct concerns, called topics. Confirming an epic opens a design conversation rather than ending one, and when you say the ground is covered the system draws out the topics, writes each a brief carrying the decisions and rejected paths that concern it, and routes each to research or discussion first. The result is the map: the list of topics with their routing and their current state.

The dashboard is how you live with an epic. It is arranged in the three stages, and under each you see the topics that have reached it, with a state line beneath each one.

```
   ○  Fresh                  on the map, nothing started yet
   ◐  Researching            research is under way
   →  Research complete      ready for its discussion
   ◐  Discussing             the discussion is under way
   ✓  Decided                the discussion has concluded
   ⊙  Dead end               research found nothing to carry on
   ⊘  Cancelled              taken out of active work
```

A few cues can appear beside a state. *Triage waiting* means a concern from another topic has been sent here and is waiting to be raised. *Input moved* means a document this topic was built on has changed and the topic should be entered to take the change into account. *In session* means another session is working this topic right now, and its row is struck through so you don't collide.

The menu beneath the dashboard carries one numbered row per topic that can move, with the recommended one marked, plus the lettered actions: run or continue discovery to reshape the map, start a discussion or research on a new topic, group concluded discussions into a specification, cancel or reactivate a topic, postpone one to the roadmap or pull a postponed one back, and re-sequence the build order, which is the suggested sequence for planning and building the specifications. Moving ahead of the build order or grouping while discussions are still open warns you and names what you are stepping past; only a specification over a discussion that is still open is refused outright, because a contract built on moving ground would be a false one.
