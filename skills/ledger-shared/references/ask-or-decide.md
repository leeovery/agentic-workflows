# Ask or Decide

*Shared reference. Loaded by `framework.md`.*

---

Which calls never become a question, and which go to `raise`. Whether a raise reaches the person is the engine's to decide, never yours: you supply the question and, on a call, your lean. A phase whose skill says how its calls go — worked through in the conversation for a time, or none settled at all — keeps its own rule, and this file gives way to it. [voice.md](voice.md) governs how a challenge sounds.

## Facts Are Checked

A question that reading the code, reading the record or running something can answer never reaches the person: check it.

Where there is more than one way and no obvious choice, find out before you lean. When each way has its pros, cons and risks and evidence can tell them apart, spike it, research it, read or reverse-engineer the source, or look at how open-source products do it, rather than guess or ask. That runs on a disposable machine or this one, without the person; where the phase records findings, what it shows lands through `ledger find` for the call to rely on.

## Decisions From Before Ledger

A decision whose entry's `session` is `migration` came across from the documents from before Ledger: it says what they decided, and the migration never read the code for its records. The code is the truth of what is built, and the person may have changed it since. Where the work finds the code built otherwise than such a decision, doing something else, record a finding on it, `how` naming the file and what in it shows this: `ledger find {place} --relies-on {decision}`, `{"text", "how", "known": "read", "by": "claude", "who_moved_whom": "none"}`. Code that does not yet do what was decided, in a part the build has not reached, is not built otherwise: it is work still to do. Code that no longer does it, in a part built and changed since, is built otherwise.

The work carries on past the finding unless it turns on which stands, the decision or the code; a build that would undo what the code does always turns on it. Then the person decides, before the code is changed: raise the decision's replacement, `raise {place} --replaces {decision} --reason new-fact --cause {finding} --always built-otherwise [--parks {task}]`, which always asks, parking in the build the task that would change the code. Its lean is your own read of which should stand: one of the proposals, or `keep`. Their keep holds the decision, and the build changes the code to match; the work that changes it replaces the finding with what the code does then: `ledger replace {place} --replaces {finding} --reason was-wrong --relies-on {decision}`, `{"drops": ["{what the finding said}"], "text", "how", "known": "read", "by": "claude", "who_moved_whom": "none"}`.

## Every Other Call Goes to `raise`

Every call you can't settle by checking goes to `raise`, the obvious ones included, however sure you are: what the person wants the product to be and do, and equally a data model, a contract, the code's insides or the process. Compose it product first where it can be; never settle it alone.

A fact only the person holds, such as a deadline or an outside constraint, goes to `raise` with `--fact`: no lean, and rows only where the answers are few and known. It is always asked, and counts for nothing in the trust layer, which takes only intent and taste. The person's answer in their own words, given through the Comment row too, goes to `raise answer {id} --own`.

In a call's raise you say whether it has one defensible answer or several. It has one where the record — decisions already made, sibling work, the brief — platform or industry convention, or first principles admit exactly one; it has several where the answer turns on what the person wants or knows. Your lean goes in the call's `lean` alone, never in the rows' words, the mechanism or `stepped_back`: the engine may hold it back and ask the call cold.

A raise may draw nothing. A call it lets proceed has landed as yours: carry on from it. One it sends back to check, check, and raise it again only if checking can't settle it. A raise drawn without your lean is answered as any other.

## Answering a Raise

- **A pick, or the person's own answer,** goes to `raise answer`, never to `gate`.
- **`e/explain`** is no answer: run `raise answer {id} --didnt-follow`, explain it again, and draw the raise again with `raise show {id}`; the question stays open.
- **`t/technical`** draws the raise again with its mechanism shown, `raise show {id} --technical`, or hidden, `raise show {id}`.
- **A comment or a question** at a raise is talked through, then the raise is drawn again with `raise show {id}`. On a fact, a comment that gives the answer is the person's own words; only a question about it is talked through and the fact drawn again.

Questions reach the person one at a time. In a conversation each slots in at a natural pause; where several wait at once they come back to back, each answered before the next shows.

## The Record of the Person

Where `enter`'s DATA names `person`, the record of the person, read it: its preferences shape what you pick, whether you decide or lean as you ask, and never whether you ask.

A preference the person states outright, or one their answers keep showing, is proposed for the record: `person propose`, with `{"preference", "why", "examples"}` on stdin. A kind they want always to come to them in this project is proposed the same way as `{"care": "{kind}", "why", "examples"}`. Where a raise's answer carries `care_drop`, propose dropping that care entry: `person propose --drop`, with `{"care": "{kind}", "why", "examples"}`, its examples the questions answered "don't care".

## Corrections

The person says a question was of another kind, or that a verdict they gave was wrong: record it, naming the entry the call or the answer landed as, `trust correct {entry} --kind {kind}` or `trust correct {entry} --verdict {verdict:[nothing|fix|loss]}`, and say it in a line.
