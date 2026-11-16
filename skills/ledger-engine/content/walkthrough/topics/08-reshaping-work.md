# Reshaping work

Work does not always run cleanly from start to finish in the shape it began. Ledger treats that as normal and gives you a small set of deliberate moves for it, reached through manage on the start menu, or, for an epic's topics, through the discovery row on the epic's menu.

```
   pivot        a feature that grew into several things
                becomes an epic in place, before its spec
   absorb       a feature moves into an epic, as one of
                its topics, both before their specs
   cancel       a piece of work, or a topic, leaves active
                work; its record stays
   reactivate   a cancelled piece of work or topic comes back
   postpone     a topic goes to the roadmap, for later
```

Every piece of work is in progress, completed or cancelled. Completed and cancelled work sits behind the start menu's `v/view` row so it doesn't clutter the day-to-day. A finished piece of work — an epic, a feature, a bugfix or a quick-fix — stays finished: nothing reopens it, and a later change to it is new work.

Inside an epic, topics have their own lifecycle. A topic can be cancelled without touching the rest, and stays listed as the record that it was raised and declined; one that belongs to a later release is postponed to the roadmap instead, and comes back when it is pulled forward into an epic whose map is still open: its own, where it returns as it was, or another, where it opens as a fresh topic that reads the earlier record and never changes it. Once the epic's specification is written its map is closed: no topic is added, cancelled or reopened, and a decision that must change is settled in the phase the epic is in.

A quick-fix that turns out to need a real decision moves to a feature or a bugfix inside its own session, its record carried with it. And whenever a decision changes, its old answer is replaced on the record rather than edited, so everything that relied on it is flagged, waiting on you to confirm it still holds or change it too.
