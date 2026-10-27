# A Factory Mode for Leeway

## The Idea

Leeway walks a person through a piece of work, collaborating as much as the
work deserves: an epic goes through the whole cone, while a quick-fix rips
straight through. A factory mode would add a second way of working beside
that one. An agent picks items off the backlog unattended, does the prep,
judges what it can, writes the code, and holds the result for the person's
review. Collaboration stays for the work that matters; the routine work
flows through on its own, under the same rules.

## Where It Came From

Lee, 2026-10-27, during the Leeway build, after seeing SuperPlane
(https://github.com/superplanehq/superplane). SuperPlane calls itself an
"open source factory for one-shot engineering" that "turns high-confidence
backlog issues into verified, review-ready pull requests". Projects like it
are appearing often. Lee: "what we are creating … isn't really a software
factory, but I think it could become one … we could probably learn a lot
from other tools."

## What Leeway Already Has Toward It

Most of the parts are being built for Leeway itself:

- **The work types scale the ceremony.** Quick-fix and bugfix already run
  with little conversation. Which items are factory-eligible is the same
  call discovery already makes about work type.
- **The decision point and the ask rule (§16, 29.19).** These decide when a
  call needs the person and when Claude proceeds. Unattended, "ask" becomes
  "hold": the question waits in a queue and doesn't block the run.
- **The ledger and the trust log.** Every decision records who made it, and
  "what have you decided without me?" is a query. The verdict queue collects
  the person's judgments of Claude's calls. A factory run's output is a PR
  plus the decisions it took on its own, ready for a verdict.
- **The state branch and the append-only ledger** already let several
  sessions write at once, so several factory runs can share a project.
- **The review phase's change-set verifiers** already judge a change-set
  against the spec without a person.

## Where It Could Lead

SuperPlane takes only issues judged "high-confidence" up front. Leeway can
earn that confidence instead. The trust log records the person's verdicts on
Claude's unattended calls, project by project, and the ask rule's arithmetic
turns that record into how far Claude may go alone. The factory's reach then
grows as the person's verdicts show the calls were right, and shrinks where
they were not. That is calibrated autonomy, not a fixed threshold, and it
would set Leeway apart.

## Open Questions

- **The runner.** Where does an unattended run live: headless `claude -p`,
  scheduled cloud agents, a worktree per item? How are cost and concurrency
  capped?
- **Picking work.** Which inbox and roadmap items are eligible, and who
  decides? Is it a predicted number of asks, or the person marking items?
- **Holding for review.** A draft PR with the ledger's account of what was
  decided alone? How do held questions come back to the person: the board,
  the start menu, the verdict page?
- **Verification without a person.** CI, the change-set verifiers, the
  one-decision check. What has to pass before a run's output is shown?
- **A survey of the field** (SuperPlane and others) before designing: what
  they gate, how they score confidence, and how failures feed back to the
  agent.

## When

After the release. The factory needs the ask rule and the trust log to have
run on real work first, since its autonomy is earned from that data.
