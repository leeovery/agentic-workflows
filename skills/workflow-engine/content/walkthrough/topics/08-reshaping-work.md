# Reshaping work

Work does not always run cleanly from start to finish in the shape it began. The system treats that as normal and gives you a small set of deliberate operations for it, reached through the manage menu on a piece of work (`m/manage` from the start menu) or through an epic's dashboard.

```
   pivot        a feature that grew into several things
                becomes an epic in place, keeping its work
   absorb       a standalone feature moves into an epic
                already underway, as one of its topics
   cancel       a piece of work, or one topic of an epic,
                leaves active work; its record stays
   reactivate   a cancelled piece of work or topic comes back
   postpone     one topic of an epic goes to the roadmap to be
                done later; starting work on it brings it back
   reopen       step back into a finished phase to amend it
   promote      a specification that describes a project-wide
                pattern becomes its own cross-cutting concern
```

Every piece of work is in-progress, completed or cancelled. Completed and cancelled work sits behind the `v/view` row so it doesn't clutter the day-to-day, and neither state is a one-way door. Cancelling removes the work's material from the knowledge base, since an abandoned decision should not resurface as advice; reactivating restores it.

Inside an epic, topics have their own lifecycle. A topic can be cancelled without touching the rest of the epic, whether or not it was started, and it stays visible on the dashboard as the record that it was raised and declined. Later work protects earlier work: a topic whose discussion a started specification is built from cannot be cancelled while that specification stands, and once building has begun under a specification it cannot be cancelled at all, because code in the tree is fixed forward through new work. The cancel menu shows every row, locked ones included, with the reason, and the confirmation names exactly what the cancel takes. A topic that is not this epic's to build — wanted, but belonging to a later release — is postponed rather than cancelled: it leaves whole for the roadmap under a horizon you name, nothing is deleted, and starting work on it is how it returns.

Reopening a finished phase is safe because the system tracks what sits beneath it. The moment you reopen something another phase was built on, that phase is marked *input moved*: the cue appears on its rows, it stops being recommended, and the mark clears the next time you enter it, where you are shown what changed upstream and the phase reconciles it. If the change turned out to matter, the rework it prompts is rework you wanted; if not, the clear is a quick touch.
