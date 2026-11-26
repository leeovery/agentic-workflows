# Raising a Call

*Shared reference. Loaded at `## Instructions`, after `framework.md`, by each phase skill that raises.*

---

Where this conversation has loaded this file already, with no compaction since, carry on from that load.

A call is a choice you make for the person, without them: what the product is and does, and equally a data model, a contract, the code's insides or the process. What the person settles themselves in a conversation, in their own words or by agreeing a view you put to them, is their decision and no call. Every call goes through `raise`, however sure you are; none is settled alone. A raise seals your own answer, your lean, before the person sees anything, so their answer is evidence of how well your calls match theirs. The ask rule is the engine's arithmetic over that evidence: it decides whether a call reaches the person, never your confidence. A call it lets go ahead lands as yours, for them to review and replace.

Where the phase's skill names a call as yours to land yourself, one to work through with the person first, or one that always comes to them, its rule stands.

## Facts Are Checked

A question the code, the record or a run can answer is a fact: check it, never ask it and never raise it. Where the phase records findings, what checking shows lands as one, for a call to rely on.

Find out before you lean. Where a call has more than one way and evidence can tell them apart — a spike, research, the source read or reverse-engineered, how open-source products do it — get the evidence first, then raise.

Where the record settles a question, it does so one of two ways:
- **The record states the answer** — a current decision, the spec or the brief says it. That is a fact: read it and work from it, and decide nothing again.
- **The record leaves one answer** — nothing states it, and what is decided admits no other. That is a call, raised with `sort` `one`.

Some calls always come to the person, whatever the counts: one that replaces their own decision, a point from before, danger — an answer that could destroy, overwrite or expose data or secrets, or weaken permissions or security — and a kind under one of their care entries. The engine tells these only at a raise, so a call landed without a raise skips them.

## The Call

The phase's skill gives a raise's place and flags. Add `--relies-on {entry_id}` for each entry the call rests on, a finding or an earlier decision: the decision the raise lands then carries those links, and a later replacement of one flags it.

The call is one JSON object on stdin, through a quoted heredoc (`<<'JSON'`) as every payload here is, `{"question", "rows": [{"key", "name", "text", "notice"}], "lean", "why", "sort": "one|several", "mechanism", "product_wide"}`, each text field one line but `mechanism`:

- `question` — what is being decided, product first and read cold: the person pictures the behaviour with no code in front of them.
- `rows` — the answers, each one rule: two at least, or on a replacement one at least. `key` is the row's id, never shown — the screen numbers the rows 1, 2, 3 as it draws them — never the screen's own `t`, `e`, `technical`, `explain`, `comment` or `keep`, and a number only where it is the row's place among the rows, from 1; `name`, a word or two naming the answer; `text`, the answer as the decision will hold it; `notice`, what the person would notice were it built. On a replacement the rows are your proposed answers, and the screen adds the person's keep row, drawn last; where one of your rows already holds the decision's answer as it stands, that row is the keep, in its own place.
- `lean` — the key of the row you would pick. Your lean goes here alone, never in the rows' words, the mechanism or anything else the call holds: the engine may ask blind, holding it back.
- `why` — why you lean so: the decision's reason where the call lands as yours.
- `sort` — `one` where the record (decisions made, sibling work, the brief), a platform or industry convention, or first principles admit exactly one defensible answer; `several` where the answer turns on what the person wants or knows. The engine counts the two apart: a `one` goes ahead as yours until the person's overrules of such calls pass their threshold, a `several` is asked until their answers on its kind show your calls match, and a call that always comes to them outranks both.
- `mechanism` — how it works beneath, in the code's terms: shown only behind the screen's `t/technical`.
- `product_wide` — `true` where the answer is a rule for the whole product, `false` where it holds for this work alone.

A fact only the person holds — a deadline, an outside constraint, an account you cannot reach — is raised with `--fact` where the phase's skill gives that door, its payload `{"question", "rows", "mechanism", "product_wide"}`: no `lean`, `why` or `sort`, and `rows` `[]` unless the answers are few and known. It is always asked, and counts for nothing in what the engine learns.

## What the Raise Answers

The answer's `decision` is the engine's:
- `ask` — drawn for the person, with your lean.
- `blind` — drawn with your lean held back: say nothing of it until they have answered.
- `proceed` — nothing drawn: the call landed as your decision. Carry on from it.
- `check` — nothing drawn or landed: the engine reads it as a fact you can find out. Check it, and raise it again only where checking cannot settle it; raised again, it asks.

Where the phase's skill says a raise is not drawn where it is made — the build's, which wait their turn — an `ask` or a `blind` does what that skill says.

## Answering a Raise

A raise is no gate: its answer never goes to `gate`. `{id}` is the one the draw answered as `raise`.
- **A row picked**, the screen's keep row among them → `raise answer {id} --pick {n}`, the number the screen draws the row under, `{"why"}` on stdin, the person's reason as they gave it. Where they pick your lean having first disagreed, then come round to your view, add `"who_moved_whom": "claude-moved-person"`, never on a blind question or the keep row; every other value is the engine's.
- **Their own answer**, a Comment that gives it among them → `raise answer {id} --own`, `{"text", "why"}`, adding `"rules_out": ["{ruled out}"]` for what their words rule out.
- **"Don't care"**, or "your call" → `raise answer {id} --dont-care`, nothing on stdin: your lean lands as your decision, marked as their "don't care", and settles this question alone; it is no evidence of how they would have answered. While a raise is on screen this is the only door for it, never the phase's own decision door: the engine counts these answers to cue dropping a care entry.
- **Explain** → `raise answer {id} --didnt-follow`; explain it again, then `raise show {id}`. The question stays open.
- **Technical** → `raise show {id} --technical`; `raise show {id}` hides the mechanism again.
- **A comment or a question** about it is talked through, then `raise show {id}`.

Where the answer carries `care_drop`, propose dropping that care entry, as the framework's **The Record of the Person** says.
