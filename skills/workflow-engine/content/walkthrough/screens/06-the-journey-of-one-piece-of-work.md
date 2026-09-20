# The journey of one piece of work

Whether it is a topic inside an epic or a feature standing on its own, the journey through the system is the same. It begins with exploring: research when there is ground to survey, and a discussion in which the design is argued through to conclusions, with an experiment along the way if a decision turns out to rest on a number nobody has actually measured. Those conclusions are written up as a specification, which is the contract everything downstream is built from, and the specification is broken down into a plan of phases and tasks. Then the building starts. Agents take the tasks one at a time, writing the tests before the code, and a review at the end holds the finished work up against the specification and says plainly whether the two match.

Not every kind of work needs the whole middle. A bugfix replaces the discussion with an investigation into why things broke, a quick-fix does the middle in a single scoping pass, and a cross-cutting concern, being a standard rather than something to ship, finishes at its specification.

```
   DISCOVERY    research → (experiment) → discussion
                what was explored, and what was decided
                              ↓
   DEFINITION   specification → planning
                the contract, then the phases and tasks
                              ↓
   DELIVERY     implementation → review
                the code, built test-first, held to the spec

   a bugfix      investigates instead of discussing
   a quick-fix   does the whole middle in one scoping pass
   cross-cutting ends at its specification
```
