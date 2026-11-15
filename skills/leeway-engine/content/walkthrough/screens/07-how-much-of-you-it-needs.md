# How much of you it needs

The amount of you each phase needs falls as the work goes on, and that is by design. At the start nearly every turn is yours: discovery and discussion are conversations, because a wrong turn caught there costs a sentence to put right and the same wrong turn caught in review costs a rebuild. By the specification the decisions are already on record, so your part shifts to approving. The build and the review phase run largely on their own.

```bars
discovery | 1 | you lead
discussion | 0.8 | you shape
specification | 0.5 | you approve
implementation | 0.2 | auto, or step
review | 0.15 | finish is yours
```

A few gates always stop for you: starting the work, approving an epic's map, a topic's decision, ready to build and finish. Everything smaller is a call, and Claude makes most of them the way you would, learning from your own answers. It asks you only where its calls of that kind have been missing more often than you allow, and a call that would be hard to undo, or that could lose data or weaken security, asks sooner or always. When you change one of its calls, you're later asked what its answer would have cost, so it learns. A routine gate you always answer the same way stops asking and reports in a line, and asks again once your answers vary.

The build runs in one of two positions, chosen at ready to build. In auto it runs on its own and stops only for what needs you. In step it also stops after each task, for you to review and try it. You can switch at any time by saying so.
