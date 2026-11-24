# The Ask Rule

*Shared reference. Loaded at `## Instructions`, after `framework.md`, by each phase skill that raises.*

---

Where this conversation has loaded this file already, with no compaction since, carry on from that load.

A call is a choice you would make for the person: what the product is and does, and equally a data model, a contract, the code's insides or the process. Every call goes through `raise`, the obvious ones included, however sure you are; none is settled alone. A raise seals your own answer, your lean, before the person sees anything, so their answer is evidence of how well your calls match theirs. The ask rule is the engine's arithmetic over that evidence: it decides whether a call reaches the person, never your confidence. A call it lets go ahead lands as yours, for them to review and replace.

Where the phase's skill names a call as yours to land yourself, or one to work through with the person first, its rule stands.

## Facts Are Checked

A question the code, the record or a run can answer is a fact: check it, never ask it and never raise it. What checking shows lands as a finding, where the phase records them, for a call to rely on.

Find out before you lean. Where a call has more than one way and evidence can tell them apart — a spike, research, the source read or reverse-engineered, how open-source products do it — get the evidence first, then raise.

One line decides where the record settles a question:
- **The record states the answer** — a current decision, the spec or the brief says it. That is a fact: read it and work from it, and decide nothing again.
- **The record leaves one answer** — nothing states it, and what is decided admits no other. That is a call, raised with `sort` `one`. Danger and the person's care entries, which always bring a call to them, are read only at a raise: a call landed without one skips them.

## Raising a Call

The phase's skill gives a raise's place and flags. Add `--relies-on {entry_id}` for each entry the call rests on, a finding or an earlier decision: the decision the raise lands then carries those links, and a later replacement of one flags it.

The call is one JSON object on stdin, `{"question", "rows": [{"key", "name", "text", "notice"}], "lean", "why", "sort": "one|several", "mechanism", "product_wide"}`, each text field one line but `mechanism`:

- `question` — what is being decided, product first and read cold: the person pictures the behaviour with no code in front of them.
- `rows` — the answers, two at least, each one rule. `key` is what the person presses, never the screen's own `t`, `e`, `technical`, `explain`, `comment` or `keep`; `name`, a word or two naming the answer; `text`, the answer as the decision will hold it; `notice`, what the person would notice were it built. On a replacement the rows are your proposed answers, and the screen adds the person's `keep`.
- `lean` — the key of the row you would pick. Your lean goes here alone, never in the rows' words, the mechanism or anything else the call holds: the engine may ask blind, holding it back.
- `why` — why you lean so: the decision's reason where the call lands as yours.
- `sort` — `one` where the record (decisions made, sibling work, the brief), a platform or industry convention, or first principles admit exactly one defensible answer; `several` where the answer turns on what the person wants or knows. The engine counts the two apart: a `one` goes ahead as yours until the person's overrules of such calls pass their threshold, a `several` is asked until their answers on its kind show your calls match, and a rule that always asks outranks both.
- `mechanism` — how it works beneath, in the code's terms: shown only behind the screen's `t/technical`.
- `product_wide` — `true` where the answer is a rule for the whole product, `false` where it holds for this work alone.

A fact only the person holds — a deadline, an outside constraint, an account you cannot reach — is raised with `--fact`, its payload `{"question", "rows", "mechanism", "product_wide"}`: no `lean`, `why` or `sort`, and `rows` `[]` unless the answers are few and known. It is always asked, and counts for nothing in what the engine learns.

## What the Raise Answers

The answer's `decision` is the engine's:
- `ask` — drawn for the person, with your lean.
- `blind` — drawn with your lean held back: say nothing of it until they have answered.
- `proceed` — nothing drawn: the call landed as your decision. Carry on from it.
- `check` — nothing drawn or landed: the engine reads it as a fact you can find out. Check it, and raise it again only where checking cannot settle it; raised again, it asks.

Where the phase's skill says a raise parks, an `ask` or a `blind` draws nothing: it parks, as that skill says.

## Answering a Raise

A raise is no gate: its answer never goes to `gate`. `{id}` is the raise's.
- **A row picked**, the screen's `keep` among them → `raise answer {id} --pick {key}`, `{"why"}` on stdin, the person's reason as they gave it. Where they pick your lean having first disagreed, then come round to your view, add `"who_moved_whom": "claude-moved-person"`, never on a blind question; every other value is the engine's.
- **Their own answer**, a Comment that gives it among them → `raise answer {id} --own`, `{"text", "why"}`, adding `"rules_out": ["{ruled out}"]` for what their words rule out.
- **"Don't care"** → `raise answer {id} --dont-care`, nothing on stdin: your lean lands as your decision, marked as their "don't care", and settles this question alone. A fact refuses it, holding no lean.
- **Explain** → `raise answer {id} --didnt-follow`; explain it again, then `raise show {id}`. The question stays open.
- **Technical** → `raise show {id} --technical`; `raise show {id}` hides the mechanism again.
- **A comment or a question** about it is talked through, then `raise show {id}`.

Where the answer carries `care_drop`, propose dropping that care entry, as the framework's **The Record of the Person** says.

## Corrections

The person says a question was of another kind, or a verdict they gave was wrong: record it against the entry the call or the answer landed as, `trust correct {entry_id} --kind {kind:[process|danger|contract|scope|look|words|behaviour|internals]}` or `trust correct {entry_id} --verdict {verdict:[nothing|fix|loss]}`.
