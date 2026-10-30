# How much of you it needs

The amount of you each phase needs falls as the work goes on, and that is by design. At the start nearly every stop is a decision that is yours: discovery and discussion stop often, because a wrong turn caught there costs a sentence to put right and the same wrong turn caught in review costs a rebuild. By the time the specification is being written the decisions are already on record, so your part shifts to reading and approving. Planning and implementation run almost entirely on their own, pausing at gates, and review is agent-led from beginning to end.

```bars
discovery | 1 | you lead
discussion | 0.8 | you shape
specification | 0.5 | you approve
planning | 0.3 | you check
implementation | 0.18 | gates, or auto
review | 0.1 | agent-led
```

A gate is never answered on your behalf, however reasonable the answer might look. If you would rather not be asked at a particular gate, you say so, and `auto` hands that one gate over for the rest of the sitting. It is scoped that narrowly on purpose: a standing preference would turn into a way of skipping decisions without noticing. A few gates never yield at all, because what they guard would otherwise be quietly overwritten.
