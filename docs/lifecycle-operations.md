# Lifecycle operations

Work does not always run cleanly from start to finish in the shape it began. A feature outgrows itself; another turns out to belong inside a larger effort; something gets shelved and later revived; a topic proves to be a dead end. The system treats all of this as normal and gives you a small set of operations to reshape work as your understanding of it changes. You reach them through the manage menu on a work unit, or through an epic's dashboard; each is a deliberate action you invoke, not something the system does behind your back.

## The status of a work unit

Every work unit is in one of three states. It is **in-progress** by default while you are working on it. It becomes **completed** when its pipeline finishes — set automatically at the end of the last phase, or by hand when you decide it is done. It becomes **cancelled** when you abandon it. Active work is what you see by default; completed and cancelled work is kept behind a "view completed and cancelled" door so it does not clutter the day-to-day, but it is not lost. Cancelling a work unit also removes its material from the [knowledge base](knowledge-base.md), because an abandoned decision should not resurface as advice on future work.

None of these states is a one-way door. A completed or cancelled work unit can be **reactivated** back to in-progress — and reactivating a cancelled one restores its material to the knowledge base, since it is live thinking again. Completed work can also be revisited phase by phase without reactivating the whole unit, when you just want to amend an earlier phase.

## Pivot: a feature that grew

Sometimes a feature turns out to be bigger than one coherent thing. What looked like a single unit of work keeps fanning out into distinct concerns, each with its own decisions to make — which is the definition of an epic, not a feature. **Pivot** converts the feature into an epic in place, so you keep everything already done and gain the multi-topic structure the work now needs. You would reach for it the moment a feature's discussion starts feeling like several discussions trying to happen at once. After pivoting you can carry straight on in the epic, or step back to where you were.

## Absorb: a feature that belongs elsewhere

The opposite situation: you have a standalone feature that, on reflection, belongs inside a larger epic already underway. **Absorb** merges the feature into an in-progress epic as one of its topics, moving its discussion (and any research, seeds, and imports) across, then deletes the now-redundant feature. Its git history remains as the record of where it came from. Absorption is guarded — the feature must have a discussion, must not have progressed past discussion into a spec or beyond, and there must be an in-progress epic to absorb it into — because merging half-specified work would tangle two pipelines together. When the guards are not met, the system tells you which one blocked and touches nothing. Reach for absorb when you realise a feature you have been discussing is really one facet of a bigger initiative.

## Cancelling and reviving epic topics

Inside an epic, individual topics have their own lifecycle, separate from the epic as a whole. You can **cancel** a single topic when it turns out to be a dead end or no longer worth pursuing, without touching the rest of the epic. A cancelled topic stays visible in the epic's display as a record that it existed, but drops out of progress counts and stops holding up the phases that depend on it. **Reactivating** it restores its prior state and, if it had completed thinking work, returns that to the knowledge base. This topic-level control exists only for epics, because only an epic has topics distinct from the work unit itself; for every other type, cancelling the topic and cancelling the work unit are the same thing.

## Promoting a spec to a standing document

Occasionally a specification you were writing for one topic turns out to describe a project-wide pattern rather than a single unit of work — a convention the rest of the codebase should follow. Such a spec can be **promoted** into its own cross-cutting concern, where it becomes a standing document of record instead of a step toward one build. This is the same recognition [cross-cutting work](work-types.md) is built around, applied after the fact when a piece of work reveals itself to be broader than it looked.

## Moving ahead of yourself, safely

One more behaviour is worth naming because it feels like a guardrail. When you navigate forward in an epic past work that is not finished — starting to specify while some discussions are still open, say — the system warns you: it points out what is still in progress and that proceeding now may mean rework later. But it is a warning, not a wall. You can proceed anyway, and if the earlier work changes what you have done, the system re-analyses and surfaces the mismatch when you return. The premise is that you are the one steering, and an informed nudge serves you better than a locked door — the recovery machinery exists precisely so that moving early is recoverable rather than forbidden.
