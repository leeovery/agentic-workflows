# Specification

The specification is the contract: a piece of work's one spec, `spec.md`, the document its build reads and you can review line by line. It is written by area from the records alone, never from a conversation, and every statement cites the ledger entries it comes from. Then it is cut into the phases the build will follow, and it closes at ready to build, where you approve it and choose how the build runs.

Nothing here decides the product afresh. A gap the specification meets, a detail no decision covers, is decided as any call is, and the answer lands on the ledger before the spec carries it. Claude orchestrates: named agents sweep the records, write the spec, review it and cut it, each from a brief the engine issues, and Claude brings you to ready to build. You meet the phase at a few points only, and between them the work runs on, with a line saying where it has got to whenever it waits on an agent.

## When it starts

- **A feature** moves into its specification once its discussion closes. Its topic has no decided gate of its own: what it decided is shown at ready to build.
- **A bugfix** moves in once its investigation closes. It has no conclude gate of its own: the recap is shown at ready to build.
- **An epic** waits until every topic is decided, cancelled or postponed, and then the epic's menu offers `s/spec`. From the spec's first writing, the epic's map is closed: no topic is added, cancelled or reopened, and a decision that has to change is settled here, as a replacement.

## The sweep

An epic with more than one live topic is swept once before the spec is written: one agent reads across every topic's records for what falls between them, the things no topic thought were its own. What it finds lands in one of two places. A point a topic owns goes to that topic as a message, which reopens it, and the spec waits until it is decided again. Work no topic owns comes to you as candidates at approve the map: a yes puts each one you keep on the map as a topic, and the spec waits until it is decided. With nothing found, the spec is written next.

## Writing and review

The writer assembles the spec from the records alone. The engine checks what it wrote and commits it, listing every line that traces to no entry. Then a review pass, by an agent that never wrote it, reads what changed against the records and the code, and what it finds goes one of three ways:

- **A rewrite** goes back to the writer, who judges it against the records.
- **A gap** is decided at the spec. It might be a detail the build would meet that no entry decides, two entries that contradict each other, an invariant that names no check enforcing it, or a reason a statement needs that no record holds.
- **A fact shown wrong**, a finding on the ledger that the code or a measurement contradicts, is replaced, and every decision that relied on it is confirmed or replaced in turn.

The writer goes again with what waits for it, and the next pass reads what changed. The review has settled once a pass changes nothing.

A gap is put to you as you meet the product, by what it does or what its user meets, never by a section's number. Where it changes a decision already made, the change is raised as a replacement of that decision, standing on its own topic, and what relied on it is flagged until it is confirmed or replaced. Where it decides something afresh, it is a new question. Either way, whether it reaches you or is answered as Claude's call is the [ask rule](trust.md)'s to decide.

## The phase cut

Once the review has settled, an agent cuts the spec into the build's phases, made from the spec's outline and the graph of what its parts rely on. Each phase names its scenarios and what it relies on from earlier phases, in the order they are built. A line it cannot cut by is a gap, decided like any other, and the cut is made again after the writer and the review have taken the answer. The cut is the agent's alone: it is never amended by hand.

The tasks are not written here. Each phase's tasks are written as that phase starts in [the build](the-build.md), against the code the phases before it left.

## Ready to build

Ready to build is the specification's gate, one screen: the spec's outline and its phase cut, which you approve together, and the build's position, which you pick. For a feature it also carries the topic's close: what it decided, the product-record lines and the candidates for the roadmap, any of which you can strike or reword. For a bugfix it carries the investigation's: the recap of the hunt, the symptoms, the root cause and the fix direction.

- **The position** is how the build runs: **auto**, where it runs on its own and only the gates that are always yours, danger and the questions that need you reach you; or **step**, where it also stops after each task for you to review and try it. Picking one is the yes. Either can be switched at any time by saying so.
- **Verdicts** come first: for each call you changed during the specification, and a bugfix's during its investigation, what Claude's answer would have cost.
- **The drivers** are checked. Where a tool the build needs is missing, too old or failing, the screen is a stop that says which and how to put it right, and it is drawn again once you say it is. [The build](the-build.md#the-drivers) covers the drivers, and [configuration](configuration.md) changing them.
- **The environment setup** is asked the first time a project reaches ready to build: how the project runs and runs its tests, the steps that prepare its environment, what cannot run at once, and its linters. It is used once you confirm it, and changed afterwards from manage. [Verification](verification.md) covers it.

A change you ask for at ready to build, to the outline, the cut or what you decided, is your decision, landed at the spec: the writer rewrites from it, the review reads what changed, the cut is made again, and the screen comes back.

The yes concludes the specification, and a bugfix's investigation, records the cut, and hands the work into the build in the position you picked.

### The review page

Where the session can publish one, ready to build offers the spec as a private page: every numbered line can be ticked or commented on, and the lines resting on Claude's calls are marked. Taking it is optional. You can check all of it, the parts you care about, or none, and skipping it is as good a way through.

A comment is answered beneath its line, in plain words saying what will change, or with a question back, and you can answer back as often as you like. A tick on a line Claude answered agrees to its answer. A change of wording alone never touches the ledger; a change to what the product does lands as your decision, and the writer rewrites from it. Each new version of the spec reaches the page without republishing, and a line whose wording changed loses its tick, for you to tick again. While a comment waits for an answer, ready to build will not take your yes.

## Splitting an epic

An epic's size is never capped by a number. When the outline you would approve grows unwieldy, or you ask, Claude proposes a split: the topics that would move, and the seam they part at, where the ledger's links show groups of topics linked within and little between. Each move is yours, one topic at a time: a whole decided topic is postponed, with its record, to a next epic on the roadmap, on a horizon you pick. The writer then goes again without them. Part of a topic never moves here: a topic too large to build whole is split in discovery, before it is decided.

## Once it is concluded

The spec is never corrected after ready to build. A decision that must change later, in the build or the review phase, is replaced on the ledger where it is found, and what relied on it is flagged; the build's tasks are reworked from the new decision. A finished piece of work is never reopened: a later change to it is new work, with a spec of its own.
