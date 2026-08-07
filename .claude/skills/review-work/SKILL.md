---
name: review-work
description: Adversarially review work just built on this project — strict adherence to CLAUDE.md and CONVENTIONS.md, broken logic, dead ends, invalid paths, regressions, and historical artefacts left in the prose. Dispatches finder agents, verifies what they return, lands fixes as new stack layers or into the PR still under review. Use whenever the user asks to review the work, do a review pass, check for regressions or convention adherence, or dispatch review sub-agents.
---

# Review Work

The standing review pass for this project, run after a piece of work is
built and before the user reviews it by hand.

What it looks for, every time: **strict adherence to CLAUDE.md and
CONVENTIONS.md; no broken logic; no dead ends or invalid paths; no
regressions; no historical artefacts or meta-information left in the
prose.** Changes are additive or leave the surface better — never worse,
never quietly narrowed.

Findings are found by sub-agents, verified by you, and fixed by you.
The user reads the chat reply and nothing else.

## Step 1: Establish the scope

Three things, before any agent is dispatched.

**The diff.** `git log main..HEAD --oneline` and `git diff main...HEAD
--stat`. If a stack is open, `gh pr list --state open` for its shape and
each PR's branch. Name the files under review explicitly — a review with
an unstated scope reports on whatever the agents happened to open.

**The intent.** The `design/` document or `ideas/` entry this work came
from, plus what was agreed in this session. The review tests the work
against **what was agreed**, not against what reads plausibly. "Everything's
implemented as we discussed" is one of the checks, and it cannot be run
without the source.

**The review state.** Which layers has the user already reviewed and
signed off? Which are still unread? Is a review live on a PR right now?
This decides Step 2 and cannot be guessed from the diff. If the session
does not say, ask.

→ Proceed to **Step 2**.

## Step 2: Decide where fixes land

If the user's request already stated it ("new pull requests on top of the
stack", "add the fixes to the PR"), follow it and skip to Step 3.

Otherwise route by review state — three regimes:

**A review is live on PR N right now.** Fixes land as commits **on PR N's
branch**. Never a side PR — it fragments the conversation the user is
having about that diff. A live review is also a hard stop on all other
work until it finishes.

**The layers are already reviewed and signed off.** They are frozen. Fixes
go in a **new branch and PR appended to the top of the stack**, one PR per
coherent change. Never amend a delivered PR and never cascade-rebase it —
that destroys the before/after boundary the stack exists to preserve.

**Nothing has been reviewed yet.** Fold each fix into the PR that owns the
code it corrects, so the user reviews the whole thing once instead of
finding a defect in PR 1 that a later PR already fixed.

**Mixed.** A fix belongs to the layer it corrects: into that PR while its
layer is unreviewed, onto a new top-of-stack PR once the layer is frozen
or the finding is unrelated to any unreviewed layer.

If the state is genuinely unclear, ask with **AskUserQuestion** before
dispatching — the answer changes where every fix goes, and moving them
afterwards is expensive. Offer the regime you believe applies first,
labelled as recommended, and say which layers you think are signed off.

Stack operations — creating, appending, linking — go through the
`pr-stacked` skill. `gh stack link` after `gh pr create` is mandatory;
skipping it loses the child branch silently.

→ Proceed to **Step 3**.

## Step 3: Dispatch the finders

Read **[references/dimensions.md](references/dimensions.md)** and pick the
dimensions the diff can actually violate. Dispatch one **workflow-reviewer**
agent per dimension, concurrently, in a single message.

Scope finders to **dimensions, never to files** — a per-file split makes
every agent responsible for the same shallow read, and none responsible
for the seam between two files, which is where this project's defects live.

Each agent's prompt carries: the dimension and its checks, the file and
commit scope from Step 1, the design source, and the instruction to assume
more defects exist and search **farthest from whatever it has already
found**. Pass an explicit `model:` on every dispatch.

Scale the fleet to the blast radius. A one-file prose fix warrants two
dimensions; a change touching the engine, the prose, and the tests
warrants the full set and a second pass afterwards from a fresh angle.

Never invoke a `workflow-*` skill and never use the Workflow tool — this
project authors the workflow system, it does not run it.

→ Proceed to **Step 4**.

## Step 4: Verify every finding yourself

An agent's finding is a claim, not a fact. Open the file and confirm it
before it becomes a fix. Finders routinely misread a conditional, report a
line the diff never touched, cite a path that does not exist, or invent a
convention the project does not hold. Applying an unverified finding is how
a review pass manufactures the regression it was run to catch.

Sort what survives:

- **Fix in place** — unambiguous, and the correct shape is not in question.
- **Bring to the user** — anything ambiguous, anything that changes agreed
  behaviour, anything where two defensible fixes exist, and any convention
  the project has not already settled. New conventions are agreed, never
  invented; when the project already has one that covers the case, follow
  it rather than inventing a variant.

Findings you checked and dismissed are process exhaust. Drop them entirely
— they do not reach the report.

Then read the coverage the agents reported back. A dimension that returned
nothing was **unexamined** as often as it was clean, and this is worth
saying out loud rather than converting into a clean bill of health.

→ Proceed to **Step 5**.

## Step 5: Apply the fixes

Prose flows are dense conditional graphs with no compiler, and a locally
correct edit collides with a return path three sections away.

Before editing any skill or reference section, grep its **inbound edges**
(`Proceed to **X`, `Return to **X`, `Load`, and every mention of its
filename) and its outbound edges. After editing, re-walk each inbound path
literally against the new text.

Any fix claiming "apply this everywhere" ships with the enumeration of
everywhere written into the commit message, each cell checked.

Verify each fix before committing it. Never batch a pile of fixes and
discover their interactions a PR later.

Then run the gates the change touches — `npm test`, `npm run test:cli`,
`npm run test:migrations`, `npm run typecheck` — and update the pipeline
simulation if the change moved an engine verb, a prose call sequence, a
phase ordering, or a manifest field. Where a finding describes a failure
the tests would not have caught, add the case that would have caught it.

Commit and push without being asked. If the diff touched skill prose, run
`node tests/prose/run.cjs select --diff main` and suggest the intersecting
cases in the report — never run the walks as part of this pass.

→ Proceed to **Step 6**.

## Step 6: Report

In the chat reply. Not a PR body — the user does not read those. Not Bash
output, not a design document.

- **Open questions first**, before anything else, each with the options
  and your recommendation. This is what the user asked to be brought to
  them, and it is the only part of the report that needs an answer.
- **What was fixed** — one line each, and which PR or branch it landed on.
- **What was examined and what was not** — the dimensions run, and the
  ones the fleet did not reach.
- **Gate results**, quoted. If a gate was not run, that is the headline of
  the report, not a footnote after it.

Never report the pass as proof that the work is clean. It is a sample —
sub-agents satisfice, circling one cluster of findings instead of
continuing to search, so an empty report means the net missed, not that
the water is empty.

## Rules

- **Finders never fix.** They are read-only by definition; every edit is
  made by you, after verification, in Step 5.
- **Never widen the work.** A review pass fixes what it finds and stops.
  Refactors, cleanups, and improvements noticed along the way are reported,
  not performed.
- **Never move a delivered PR.** Amending or force-pushing a layer the user
  has already read erases the boundary between what they reviewed and what
  they did not.
- The user's approval of an earlier layer is not approval of a fix landing
  on top of it. Each new PR is its own review.
