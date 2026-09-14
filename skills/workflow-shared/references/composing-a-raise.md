# Composing a Raise

*Shared reference. Loaded by discussion's `background-agent-surfacing.md` (the findings walk) and `rerouted-concerns.md` (the triage raise) at raise composition.*

---

**Parameters** (provided by caller via Load directive):

- `source` — `review` | `synthesis` | `reroute` — what the raise digests: a background review's finding, a synthesis's tension, or a concern rerouted from a sibling topic
- `origin` — with `reroute` only: the topic that rerouted the concern, named in the raise as where it came from

A raise is an opener, never a case: its whole job is to put the user in front of the problem and say where you stand. Everything else — the record's full case, your own supporting analysis, the costs, secondary consequences — stays back and enters the conversation as responses, when the user's reply calls for it. The record — the finding's report section, the concern's queue entry — is never the script: digest it, and digest it upward — a problem written in code is retold as what the product does, at the level [altitude.md](altitude.md) sets, whatever level the record chose. A mechanism is retold as the behaviour it produces, wherever in the raise it appears; its tuning — a weight, a threshold, a window — stays in the record.

Three beats, composed in order, then held until the caller emits the raise.

## A. The Problem

Made immediately graspable, from zero. The product's situation opens — what its user meets and what happens to them — before anything else: the first sentence names the product's user and their moment, and names no report, agent, finding, queue, or sibling topic. Where the problem came from rides in a clause once the situation is on the page — the background `review` and what it observed; the `synthesis`'s two positions in tension; for a `reroute`, what `{origin}` settled and what it now asks of this topic. A raise that opens on the report being back, on the queue, or on what a sibling looked at, has opened on the wrong thing. Make the problem land before your position arrives: one to three devices, technical depth only as deep as seeing the problem needs. For the devices and the test:

→ Load **[making-it-land.md](making-it-land.md)** and follow its instructions as written.

Every raise is a cold start — it lands in a corner of the document the user last held fully hours or days ago, or on ground a sibling's session worked while this topic sat — so rebuild what seeing the problem requires, and nothing more. Restate any term borrowed from another subtopic, another thread, or an earlier decision; never reference it bare. Never use a bare id (`F5`, `T2`, `003`) as a label in conversational prose — name a finding by its report title and a concern by its entry's title on first mention, or describe it by what it is; ids belong in commit subjects (`(review-003 F5)`, `absorb 003-{slug}`) and in-document markers (`(resolves review-003 F5)`), not in the conversation. When an earlier raise from this set has gone before — the report's findings, the queue's concerns — open with a one-line bridge: what the previous one settled — or simply that it was raised, when that engagement predates this session — and how many follow this one (the walk: the surface response's `remaining`, counted within its lane; the queue: the `topic queue` count less this one).

→ On return, proceed to **B. The Position**.

## B. The Position

Always. Where you stand and the one load-bearing reason that carries it — a clause, not the derivation — at the firmness the answer has actually earned. Where the position leans against an alternative, that alternative gets **at most one clause naming the kind of cost it carries** — never two costs, never a cost with its consequence spelled out, whether the cost comes from the record or from your own reading. A clause that enumerates or explains has become the case, and the case stays back.

**Firmness** — judged live against the session, never read off the record. Where re-derivation moves the problem itself — it holds, it's narrower than framed, a decision made since the record was written already covers it — that is part of the position; say it. Then match the register to how determined the answer is:

- **One defensible shape** — a decision is owed and re-derivation can't find one to make: say so openly, propose it plainly — a cost worth knowing rides in a clause — and offer to lock it in unless the user has something to add. Still a presentation, never a demotion: the user sees it whole and can push back before anything lands.
- **A preferred path among real options** — name your pick and its reason; the alternatives get a clause each, enough to push back on — never an option survey. The close points back at the pick's stated reason as what a push-back would have to move — it introduces no new material.
- **Genuinely open** — the user holds what the document lacks (a finding promoted on the user's own knowledge is this by construction): say what you'd need to know and ask for it — the raise's one genuine question lives here.
- **Needs investigation** — an experiment or a research pass beats either of you guessing; suggesting it is the position. Where the caller carries a **Lanes** declaration naming the walked lane's move, that move closes the raise.
- **No lean at all** — rare and honest: say so flat and ask for the user's read. Never manufactured; reach it only when re-derivation truly leaves nothing.

The position answers the problem's own question, never its bookkeeping: proposing to park, defer, requeue, or record it as open is not a position — deferral is an outcome the user may choose, never one the raise proposes. A made call reopened — a finding pulled from the decide screen, a concern landing on decided ground — puts what the call rested on beside what has moved: a pulled finding asks what the derivation missed; a concern on decided ground says whether the call still holds.

→ Proceed to **C. Where the Ball Sits**.

## C. Where the Ball Sits

The raise ends by saying what kind of reply moves things forward. One of three shapes:

- **A question**, where the position turns on something only the user holds. A literal question, composed as altitude prescribes: the situation the user would be in, then what the product is or does on each side — one line per side where there are sides to choose between, so a number or a word answers it — and the one question mark that asks. Each side names what the product does, never the number that tunes it. Sides that cannot be composed as product end states mean the raise has no question for the user: it is material for the record, and the close takes the third shape instead.
- **An invitation to push back**, where a real choice exists — pointing at the load-bearing reason the opener already gave as what a different reading would have to move, so the invitation belongs to this problem rather than to politeness.
- **Nothing needs a call** — say so plainly and offer the pause: they are free to read and weigh in, and a word from them moves things on.

A dead stop is not an ending: a raise that trails off after its position leaves the user unsure whether a reply is owed or the conversation broke. No keyed menu, no bundled follow-ups, no stock closer: "what do you think?" is never the ask, and a closing beat repeated verbatim across a walk or a queue reads as chrome, not a colleague — phrase it from the problem just raised. The beat draws only on what the opener already said — reaching into the held-back depth for a concrete pivot is how the case leaks back in one clause at a time.

**The test**, before the raise goes out — read it as the user will, cold, in one glance: they can picture the behaviour, they know where you stand, and they know what reply is wanted, with no code identifier, no report or sibling topic named ahead of their situation, no tuning number in front of them, and no second cost on the alternative. A raise that fails is recomposed at altitude, never sent and explained after.

→ Return to caller.
