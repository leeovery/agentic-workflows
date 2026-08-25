# Sub-groups Within an Epic

## The Idea

Introduce a grouping layer *inside* an epic — a named, ordered subset of
topics you can specify, plan and implement end-to-end without touching the
rest of the epic.

Parked deliberately during the build-order discussion (2026-08-20). Logged
so it can be picked up after the flat build order has been used on real
epics. See `design/build-order.md`.

## Where It Came From

A large discovery session — particularly one pulling several roadmap items
through at once — can land a lot of topics in one epic, and they may
resolve into two or three genuinely distinct systems. The user wants to
build the first system end-to-end without first specifying the other two.

The concern: expecting a full spec sweep across three separate systems
before any code is a lot to ask, and the user should not be penalised or
restricted for wanting to take one system at a time.

## Why It Was Parked

**The flat build order already gets most of the way.** If system one is
topics 1–5, you spec 1–5, plan 1–5, build 1–5 and stop. Nothing restricts
you and nothing penalises you. What a group adds beyond that is a *name*,
a *visible boundary*, and *aggregate state* — real, but a lot of new
machinery for something judgement plus an order already delivers.

**The roadmap layer overlaps it.** Horizons are already user-named,
ordered buckets of capability-grain items, and the pull is what fences a
work unit. Three distinct systems landing in one epic may be a signal
about how the pull was fenced rather than a gap inside the epic. That is
the first place to look before building anything here.

**Milestones are the wrong frame.** Milestones conventionally sit *above*
an epic; introducing them as a sub-unit inverts the usual hierarchy. If
the grouping is strong enough to need lifecycle and gating of its own,
that is an argument the topics should have been separate epics.

## Cheapest Viable Shape (if it survives use)

An optional **label** on the topic, plus dividers on the epic dashboard.
The build order still governs sequencing; the label only groups the
display. No new lifecycle, no aggregate state, no gating. That form can be
added later without redesigning anything.

## What Would Justify Building It

Real use showing that a flat order over a large epic is genuinely hard to
navigate — that users lose track of which topics form a coherent
deliverable, or repeatedly want to reason about "this set" as a unit.
Until then, the order plus judgement is the cheaper answer.
