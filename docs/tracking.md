# Tracking

A model holds nothing between sessions, and memory doesn't replace knowing where every piece of work stands. Tracking is the part of Ledger that does: the start menu, the inbox, the roadmap and the menus of the work itself. Together they hold your work across sessions, so you never have to remember which phase something is in or what command continues it.

## The start menu

`/ledger` opens on the start menu, and every piece of work begins and resumes there:

```text
Inbox: 2 ideas · 1 bug · 1 quick-fix

◆ What would you like to do?

1         → Continue feature: Saved Filters — build, phase 1 of 3
2         → Continue bugfix: Export Timeout — investigation
3         → Continue epic: Payments Overhaul — discussion, 1 of 3 topics decided
p/product → Talk about the product
s/start   → Start something new — describe it, and we'll find what kind of work it is
t/triage  → Triage the inbox
r/roadmap → Open the product roadmap
v/view    → View completed & cancelled work units
m/manage  → Manage work units
h/help    → How Ledger works
```

Each piece of work in flight is one row, its kind first, with where it stands — "discussion, 1 of 3 topics decided", "build, phase 1 of 3" — and never its topics. What waits on you in a piece of work shows as a count on its row, "1 question waiting for you", and those rows come first. Picking one takes you straight to where it stands: a feature, bugfix or quick-fix into its current phase, an epic onto its own menu, where what waits on you is listed first again.

The other rows:

- **`s/start`** begins something new. Describe it in your own words; [discovery](discovery.md) settles what kind of work it is as you talk. There are no start-by-type rows.
- **`p/product`** carries on the conversation about the product as a whole: what it is, who it serves, where it is going. It is always there, with its session count once it has sessions.
- **`t/triage`** works through the inbox, and **`r/roadmap`** opens the roadmap; both are below.
- **`e/verdicts`** shows only while a call you changed waits for your verdict, the [verdict queue](trust.md#verdicts).
- **`v/view`** lists completed and cancelled work once any has closed, each opening in manage.
- **`m/manage`** is where work changes shape — pivot, absorb, cancel, bring back — and where the project's setup, its drivers and [the matrix](trust.md#the-matrix) are changed. [Lifecycle operations](lifecycle-operations.md) covers the reshaping; [configuration](configuration.md) the setup and drivers. <!-- 19.12 -->
- **`h/help`** is on every menu: what the screen is for and what each row does, then an invitation to ask about anything else. The start menu's help also leads to the walkthrough and to a card on each part of Ledger.

You rarely need the menu to start. Ask Claude for a change in the middle of any conversation and it takes your words into Ledger itself, going straight into Start or into the piece of work they name; the start menu is drawn only when you type the bare command.

## The inbox

Not every thought arrives ready to become a piece of work. Mid-way through building one thing you notice another that is broken, an idea worth exploring later, or a small change that ought to happen sometime. The inbox is where such thoughts wait so you can keep working.

You capture by asking, in any conversation — "log that as an idea", "log this bug", "log a quick-fix" — and Claude writes a short note into the inbox of the project it concerns, committed at once, then carries on with what you were doing. There are three kinds:

- an **idea**: something you might build or explore;
- a **bug**: something broken — its symptoms, the conditions, the impact;
- a **quick-fix**: settled work needing no decision — what, where and why.

Capture is deliberately narrow. It writes your thought down faithfully and nothing more: it doesn't read the code, judge the idea, diagnose the bug or suggest an approach. The thinking happens later, if you decide the thought is worth it. A capture made from a session in another project lands in the inbox of the project it concerns.

## Triage

The inbox is where items live; triage is deciding on them. `t/triage` lists the inbox by kind, each item with its age. Pick items by number, and Claude names others that fit with them; `c/change` adds to what's picked or takes some out. Then, for what's picked:

- **`w/work`** starts on it now, as one piece of work. Whatever kinds it mixes, discovery settles what kind of work it is from the conversation, and the items become its **seeds**, the recorded reason the work exists, read early by its first phases.
- **`r/roadmap`** puts it on a horizon you name. Claude never picks one, and asks where you haven't said.
- **`a/archive`** takes it out of the inbox.

Archived items are not gone. `v/view` lists them, to restore one to the inbox or delete it for good.

When a piece of work finishes, Claude checks the inbox against what was built, archives each item the work resolved as closed by it, and lists them in the finish report, so nothing is silently discarded and a wrong closure can be restored. An item fixed straight away, outside any piece of work, is closed the same way with its date.

Seeds are not the only early material. A file you share with the work — notes, a design document, a screenshot, an error report — is kept with it as an **asset**, and linked from the entry it informs. One is the spark and the other is fuel.

## The roadmap

Some conversations are about the product rather than a piece of work: a new product being conceived, what the next few months should hold, a v2 taking shape. Those happen in the product's own conversation, `p/product`, and what they shape lands on the roadmap. It sits above the pieces of work and holds everything you have decided on but not yet started: ideas, bugs and quick-fixes alike.

**Items** are what it holds, each one line with its kind and where it came from, its summary shown when you pick it or ask. **Horizons** are the buckets they sit on, named in your own staging words — launch, v1, someday — and their order is the meaning: the first is next. A horizon you call Backlog or Later is your backlog; there is no other.

Things land on it four ways:

- **From the product's conversation.** When you call for it at the end of a session, Claude proposes the capabilities it heard as items, each on a horizon you named or one it asks for, and they land on your yes.
- **In one line, from anywhere.** Mid-way through any conversation, say where something belongs — "that's a v2 thing", "on the roadmap under Next" — and it goes on that horizon, reported in one line, without opening the roadmap. Where your words put something aside without saying where — "backlog that", "not now" — Claude asks whether it goes on the roadmap or into the inbox, and never chooses.
- **From triage**, as above, each inbox note travelling with its item.
- **A postponed topic.** An epic's topic that belongs to a later release is postponed onto the roadmap rather than cancelled, and keeps saying where it came from.

The horizon is always yours: named in your words, or asked for — even when only one horizon exists, since it may be the backlog when you want the item next. Claude never names one.

The roadmap's own rows: `w/work` starts on the items you name, `n/new` adds one, `m/move` puts one on another horizon, `a/archive` takes one off, and `p/product` opens the product's conversation. Renaming an item, or adding, renaming, reordering, merging or removing a horizon, is done by asking in words, reported in one line.

## Starting work from the roadmap

Work begins when you pick items with `w/work`. They go into discovery together as the seeds of one piece of work, and discovery settles its kind, a quick-fix included; Claude names what stays waiting on the horizon. Discovery reads each picked item's note and the parts of the product's conversation its pointers name, and only those, so the new work opens knowing why it exists without inheriting the whole product. An item can also join an epic in progress as a new topic, through that epic's discovery.

A started item leaves the roadmap, which shows only what still waits; from then on the work shows its progress. If the work is cancelled, or the topic it became is cancelled, the item returns to waiting. A postponed topic pulled back into its own epic returns exactly as it was; pulled into another epic, it opens as a fresh topic that reads the earlier record and never changes it.

## The product record

The roadmap holds what is planned. What the product *is* — who it is for, what it values, the standing rules that cut across topics — is the **product record**: the entries on the [ledger](trust.md#the-ledger) marked product-wide, read as one view. Every topic's opening reads it. Discussion decides it; the product's conversation only feeds it, and its logs stay as the source the roadmap's items point back to.
