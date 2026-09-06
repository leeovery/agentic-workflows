# Composing a Raise

*Shared reference. Loaded by `background-agent-surfacing.md` (the findings walk) at the raise.*

---

**Parameters** (provided by caller via Load directive):

- `agent_type` — `review` | `synthesis` | `deep-dive` — the report's kind, named in the raise as where the finding came from

A raise is an opener, never a case: its whole job is to put the user in front of the problem and say where you stand. Everything else — the report's full case, your own supporting analysis, the costs, secondary consequences — stays back and enters the conversation as responses, when the user's reply calls for it. The report is the record, never the script: digest it, and digest it upward — a finding written in code is retold as what the product does, at the level [altitude.md](altitude.md) sets, whatever level the report chose. A mechanism is retold as the behaviour it produces, wherever in the raise it appears; its tuning — a weight, a threshold, a window — stays in the record.

Three beats, composed in order, then held until the caller emits the raise.

## A. The Problem

Made immediately graspable, from zero. The product's situation opens — what its user meets and what happens to them — before anything else: the first sentence names the product's user and their moment, and names no report, agent, deep dive, or finding. Where the finding came from (the background {agent_type}) and what it observed ride in a clause once the situation is on the page — for a synthesis, the two positions in tension; a raise that opens on the report being back, or on what it looked at, has opened on the wrong thing. Make the problem land before your position arrives: one to three devices, technical depth only as deep as seeing the problem needs. For the devices and the test:

→ Load **[making-it-land.md](making-it-land.md)** and follow its instructions as written.

A findings walk is a series of cold starts — each raise lands in a corner of the document the user last held fully hours or days ago — so rebuild what seeing the problem requires, and nothing more. Restate any term borrowed from another subtopic or an earlier decision; never reference it bare. Never use a bare id (`F5`, `T2`) as a label in conversational prose — name the finding by its report title on first mention, or describe it by what it is; ids belong in commit subjects (`(review-003 F5)`) and in-document markers (`(resolves review-003 F5)`), not in the conversation. When earlier findings from this set have been raised, open with a one-line bridge: what the previous one settled — or simply that it was raised, when that engagement predates this session — and how many follow this one (the surface response's `remaining`, counted within this lane).

→ On return, proceed to **B. The Position**.

## B. The Position

Always. Where you stand and the one load-bearing reason that carries it — a clause, not the derivation — at the firmness the answer has actually earned. Where the position leans against an alternative, that alternative gets **at most one clause naming the kind of cost it carries** — never two costs, never a cost with its consequence spelled out, whether the cost comes from the report or from your own reading. A clause that enumerates or explains has become the case, and the case stays back.

**Firmness** — judged live against the session, never read off the report. Where re-derivation moves the finding itself — it holds, it's narrower than framed, a decision made since the report already covers it — that is part of the position; say it. Then match the register to how determined the answer is:

- **One defensible shape** — the lane asked for a decision and re-derivation can't find one to make: say so openly, propose it plainly — a cost worth knowing rides in a clause — and offer to lock it in unless the user has something to add. Still a presentation, never a demotion: the user sees it whole and can push back before anything lands.
- **A preferred path among real options** — name your pick and its reason; the alternatives get a clause each, enough to push back on — never an option survey. The close points back at the pick's stated reason as what a push-back would have to move — it introduces no new material.
- **Genuinely open** — the user holds what the document lacks (a finding promoted on the user's own knowledge is this by construction): say what you'd need to know and ask for it — the raise's one genuine question lives here.
- **Needs investigation** — a spike or deep-dive beats either of you guessing; suggesting it is the position. Where the caller's **Lanes** declaration names the walked lane's move, that move closes the raise.
- **No lean at all** — rare and honest: say so flat and ask for the user's read. Never manufactured; reach it only when re-derivation truly leaves nothing.

The position answers the finding's own question, never its bookkeeping: proposing to park, defer, or record the finding as open is not a position — deferral is an outcome the user may choose, never one the raise proposes. A finding pulled from the decide screen reopens a made call: put the derivation on the table and ask what it missed.

→ Proceed to **C. Where the Ball Sits**.

## C. Where the Ball Sits

The raise ends by saying what kind of reply moves things forward. One of three shapes:

- **A question**, where the position turns on something only the user holds. A literal question, composed as altitude prescribes: the situation the user would be in, then what the product is or does on each side — one line per side where there are sides to choose between, so a number or a word answers it — and the one question mark that asks. Each side names what the product does, never the number that tunes it. Sides that cannot be composed as product end states mean the raise has no question for the user: it is material for the record, and the close takes the third shape instead.
- **An invitation to push back**, where a real choice exists — pointing at the load-bearing reason the opener already gave as what a different reading would have to move, so the invitation belongs to this finding rather than to politeness.
- **Nothing needs a call** — say so plainly and offer the pause: they are free to read and weigh in, and a word from them moves the walk on.

A dead stop is not an ending: a raise that trails off after its position leaves the user unsure whether a reply is owed or the conversation broke. No keyed menu, no bundled follow-ups, no stock closer: "what do you think?" is never the ask, and a closing beat repeated verbatim across the walk reads as chrome, not a colleague — phrase it from the finding just raised. The beat draws only on what the opener already said — reaching into the held-back depth for a concrete pivot is how the case leaks back in one clause at a time.

**The test**, before the raise goes out — read it as the user will, cold, in one glance: they can picture the behaviour, they know where you stand, and they know what reply is wanted, with no code identifier, no report named ahead of their situation, and no tuning number in front of them. A raise that fails is recomposed at altitude, never sent and explained after.

→ Return to caller.
