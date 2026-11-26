# Background Agents

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

- A Deep Dive
- The Background Review
- Perspectives
- When a Report Lands: The Core Rules, The First Read, Deciding the Action
- A Report's Findings: The Walk, The Never-Dump Checklist

The deep dive, the background review and the perspectives read the topic from its record, the review from its log too, never the conversation, and run in the background while the conversation carries on. Each is dispatched, then briefed, then called: the Agent call's `subagent_type` is the agent `brief` answers, its prompt the pointer alone. `{agent}` is the `id` a dispatch answered; for an agent an earlier conversation left, the id the DATA's `lost` line gives or the name of its `landed` line's file, its row's `id` in `agent scan`. `{id}` is the question on the map the agent works on.

## A Deep Dive

Offer it in the conversation; one the person asks for needs no offer. The question it answers is on the map, asked first where it is not. Pick its kind:
- `survey` — how several implementations do it;
- `read` — one file held against the question, named by `--path`;
- `feasibility` — whether the platform can do it;
- `landscape` — what exists, what it costs, where the gaps are;
- `verify` — a claim held against sources.

Dispatch it under a kebab-case label, brief it, then make the Agent call:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind deep-dive --label {slug}
node .claude/skills/ledger-engine/scripts/engine.cjs brief deep-dive {work_unit} {topic} --question {id} --agent {agent} --kind {kind} [--path {file}]
```

## The Background Review

A review agent reads the topic with a clean slate in the background, identifying gaps, shallow coverage, and missing edge cases. It reads the log: bring it up to date before the dispatch. A dispatch refused — mail waiting, or too few moves since the last review — leaves the conversation carrying on: dispatch again later. `--final` waives the count, and only for a review the person asked for, whatever the refusal suggests.

**If the person explicitly asks for a review:** their request is the trigger — the back-off doesn't apply, and the dispatch carries `--final`. A review is still stale on arrival over mail waiting or an earlier review's findings not yet taken, whoever asked. Record anything the conversation has settled first — the agent reads the record and the log, not the room — and clear what blocks (take the earlier review's findings, take the mail), then dispatch.

**Why a review waits for the mail and the earlier findings**: two reasons, both important. First, dispatching a fresh review while the prior review's findings are still being discussed produces stale analysis — the record will look different once those findings land, and the new review would be critiquing a version the person is already fixing; a waiting message is a pending change to the record in the same way, so a review dispatched over it is stale on arrival. Second, the wait is self-healing: the next meaningful write after the earlier findings are taken, or the mailbox empties, re-fires the dispatch check, so no trigger is lost — whether it dispatches is then the back-off's call. If the session ends before the findings are taken, the agent's row keeps the ones not yet surfaced, and the next session's `agent scan` lists it.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind review [--final]
node .claude/skills/ledger-engine/scripts/engine.cjs brief discussion-reviewer {work_unit} {topic} --agent {agent}
```

Say `Background review dispatched. Results will be surfaced when available.` The discussion continues — do not wait for the agent to return.

## Perspectives

Offer them where a decision point shows **genuine ambiguity** — two or more viable approaches where the tradeoffs are not obvious. Signals:
- Multiple defensible approaches with no clear winner
- The person expresses uncertainty ("I'm not sure which...", "they both seem fine")
- The domain has known competing paradigms (e.g., relational vs document, monolith vs microservices, sync vs async)
- The person disputes a challenge and remains unsettled — a decisive answer to a challenge is settled, not disagreement

Signals are read from the conversation, never from domain shape alone — a known competing-paradigm pair is not a trigger until the person has engaged the decision and the ambiguity has shown itself. Do not offer them when the decision is straightforward, the tradeoffs are already well understood, or the person has already made a confident decision.

Offer them in the conversation. On yes, the decision's question on the map, asked first where it is not, pick the polarity pair whose tension it turns on, from the pairs in `.claude/agents/ledger-discussion-perspective.md`, and dispatch both lenses as one set; brief each agent the response's `agents` names, and call both:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind perspective --label {lens} --label {counter_lens}
node .claude/skills/ledger-engine/scripts/engine.cjs brief perspective {work_unit} {topic} --question {id} --agent {agent}
```

Once both have reported, the synthesis reconciles them, on the `set` the dispatch answered:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind synthesis --set {set}
node .claude/skills/ledger-engine/scripts/engine.cjs brief synthesis {work_unit} {topic} --agent {agent}
```

The perspectives feed the synthesis, never the conversation: once it is dispatched, close each of the set's perspectives, `agent incorporate {work_unit} discussion {topic} {agent}`.

## When a Report Lands

`agent scan {work_unit} discussion {topic}` lists what has landed as `pending`. A perspective waits for its synthesis. A `lost` agent went with the conversation that dispatched it and will never report: close it, `agent incorporate {work_unit} discussion {topic} {agent}`.

**A deep dive's report** is read in full, then `agent ack {work_unit} discussion {topic} {agent} --clean`. What it learnt lands as findings, each saying how it is known as the report does, and the log keeps what came back. The person hears it, at a natural break as **The Core Rules** say: what was asked, what came back, what it opened, and its answers in full. Each line under its Opened is judged: a new question on the map, a point another topic owns, a number a decision would rest on — the laboratory's cue — or nothing worth carrying.

**Any other report** — the background review's, the synthesis's, the closing pass reader's — is taken in as below.

### The Core Rules

**What reaches the person matches the move owed, never the finding's importance.** Four hard rules govern every surfacing interaction:

1. **Two-phase surfacing.** First say the report exists, in a line, no content: mid-thread the parenthetical, at a natural break the count (**Deciding the Action**). Only at a natural break start on its findings.
2. **One open ask per turn.** A surfacing turn ends only on a pending ask — one finding put to the person awaiting their answer — never after a completed action: a finding you settle rolls into the next in the same turn, and a closed engagement takes up the next as **The Walk** says. Inside the walk, one finding per turn, always.
3. **Mid-thread protection.** If you are mid-Q/A with the person, hold everything until the next natural break. A one-line parenthetical is acceptable, but only the first time.
4. **Findings move toward the person, never away.** A finding you would settle moves to the ones that need the person the moment you find a real choice hiding in it, or the person says it isn't settled. Only the raise moves a finding away from the person (**A Report's Findings**); a finding that needs them is never settled to save a turn.

Natural-break detection is guidance, not hard-enforced: [natural-breaks.md](../../ledger-shared/references/natural-breaks.md), in context.

This runs as a turn-level check, not a long-running state machine. Each visit runs one `agent scan` and acts on its answer. Turns end at asks, never after actions: once a finding is put to the person, control belongs to the conversation — do NOT wait "inside the walk" for the person to finish engaging. A walk the person steps away from resumes at the next natural break — the agent's row says exactly where things stand, its `remaining` the findings not yet surfaced.

**The agent's row is the only state of what has surfaced.** Never track surfacing progress in conversation memory. The report is durable — re-read it rather than recalling it.

**Coverage guarantee**: the goal is natural flow during engagement AND eventual coverage of every finding. The row ensures nothing is forgotten across turns — at each natural break the next finding is taken up. When all findings have been surfaced, the engine closes the row.

### The First Read

Read the report completely. The finding ids come from its `### {ID}:` section headings — the review's `F1`, `F2`, …, the synthesis's tensions `T1`, `T2`, …; cross-check the count against the agent's own return where it is still in context.

Read each finding's lane from its report section (**A Report's Findings**), then re-derive it against the live session — the report was written cold, this conversation wasn't: one whose stated derivation no longer holds (a decision made since the report, ground the session has moved, a dependency on a finding still open in this set), whose section carries no derivation at all, or whose call you cannot yourself stand behind, needs the person.

**If the report has no findings** (zero-gap case): `agent ack {work_unit} discussion {topic} {agent} --clean`. At the end of your current turn, above the gate where one is waiting on the person, say `Background {agent_type} returned — nothing new beyond what we've already covered.`, `{agent_type}` the agent's kind: review, synthesis, closing pass.

**Otherwise** record its findings by the ids its headings carry, `agent ack {work_unit} discussion {topic} {agent} --findings {F1,F2}`.

### Deciding the Action

The row's `remaining` list is the unsurfaced set. A row acknowledged in an earlier sitting arrives here unread — read its report and re-derive its findings as **The First Read** says before anything reaches the person, acknowledging nothing again.

**If NOT a natural break:** consult the natural-breaks checklist. The first time, at the end of your current turn, above the gate where one is waiting on the person, say `(Background {agent_type} just returned — I'll raise it when we pause.)`. Once said, nothing more: the next natural break picks it up.

**At a natural break:** take each finding as **A Report's Findings** says — settling what you can, each call through its raise, what the ask rule lets go ahead settled, what it asks joining the ones that need the person. Then one line with the count: how many you have settled, those sent to another topic among them, and how many need the person. Do not describe individual findings, do not summarise, do not preview; never count a settled finding among the ones that need the person — it reads as decisions still owed when the calls are already made. Then take up the first of the ones that need them (**The Walk**).

**When no finding remains:** the row is closed. Close it out loud in this same turn, never silently: one line that the {agent_type}'s findings are worked through, then hand the conversation back where the report interrupted it — resume the open thread, or when the session was already winding down, say so and name the next move.

## A Report's Findings

The background review's findings and the closing pass reader's each come with a lane, the reader's read of where the finding goes; a synthesis brings tensions. The lane is where you start, never where a finding must end: re-derive each from the record before you act on it.
- **apply** — the reader takes the record or a fact to settle it: check that it does. Where a current decision states the answer, the question merges into that decision, nothing decided again; where the code or a run answers it, it closes as the skill's **Research** says; where the record only leaves one answer, or contradicts the finding, it is a call.
- **call** — a call the topic leaves open is talked through with the person, or raised where you would make it without them. A fix you cannot stand behind is raised as a call with several defensible answers.
- **route** — another topic's: a message, the question moving with it. Work no topic owns goes as the skill's **A message** says.

A synthesis's tensions are told to the person; one they take up is a question on the map. Each of its Unresolved Questions is judged as a deep dive's Opened line is.

A finding is a question the review asked, `ledger ask` with `"by": "review"`, reframed as a practical concern tied to the project's constraints, unless it would change a decision, which is raised as that decision's replacement and asks none, or it asks nothing of the map: work no topic owns, a `product` line, a tension the person has not taken up. Each is recorded as it is taken, `agent surface {work_unit} discussion {topic} {agent} {finding}`, adding `--question {id}` for the question it was asked as, or `--replaces {decision_id} --reason {reason}` for the decision it was raised to replace; one that asked nothing takes neither.

A finding a later decision has made moot is dropped, and you say so in one line. A finding bound for the person is checked first against the answers given earlier and the record. Only the raise moves a finding away from the person: one that turns out to hide a real choice goes to `raise`, never settled alone. A finding the person waves off is answered, as "don't care" or as their own decision, never left open; another topic's still goes there. No finding is cut for count.

### The Walk

This runs once per visit and then exits. It never waits for the person to finish engaging — that's the conversation's job.

1. Pick the single most contextually relevant finding of the ones that need the person. **Contextual relevance outranks the list order.** When engaging the previous finding built a scene — a worked scenario, a diagram, one corner of the record — prefer remaining findings that live inside it, and exhaust them before opening a new corner: the reconstruction is already paid for. Otherwise, if the current conversation has just touched on a related area, prefer that finding; if nothing is particularly relevant, pick the one with the broadest implications.
2. Put it from the finding's section of the report — digested, never read out — as [putting-a-point.md](../../ledger-shared/references/putting-a-point.md) says, in context; a raise that asked, as the skill's raise door says.
3. Put it in the current turn, then stop — one per turn. The point proposes and never lands: whatever its firmness, no answer is recorded until the person has replied, and the next finding waits until this one's outcome is recorded.

The walk's first finding opens with its marker, ``**`▪ Needs A Decision`**``, so the shift into the walk is visible. A walk already under way — including one resumed from an earlier session — opens with its bridge instead, never a repeated marker.

After this, control belongs to the conversation. The person will engage (or reject, or redirect) naturally. Handle their response as normal discussion. Their reply calibrates what comes next: the depth the opener held back — the report's full case, the derivation, the costs — enters as responses, each piece when the direction on the table calls for it. A reply that shows the problem didn't land is re-grounded simpler — a different analogy, a smaller example — never the same explanation again, louder. An engagement ends resolved or waved off, and either way its answer is recorded: a decision, the raise's answer, or the "don't care" or own decision a wave-off is answered as. Either close is a natural break: take up the next in the same turn, so the next point follows while the context is warm. When it was the last, close the walk as **Deciding the Action** says.

Waving a finding off settles interest, never ownership: a finding whose home is another topic still goes there, whatever the person makes of it here.

### The Never-Dump Checklist

Before producing any surfacing output, verify:

- At most one OPEN ask this turn — one finding put to the person awaiting their answer; a settled finding rolls into the next, but nothing ever stacks unanswered
- In the walk: AT MOST one finding, AT MOST one question — a genuine one only the person can answer, never a manufactured invitation, never an ask to park or defer — and the problem made graspable before the position lands
- The point's last beat says where the ball sits — a genuine question, a push-back point drawn from what the opener already said, or a stated nothing-to-decide with the pause offered — never a dead stop after the position, never a stock closer, never new material from the held-back depth
- The point is an opener, not the case — a position with its one load-bearing reason; the report's full case, the derivation, and the costs stay back until the conversation asks. The alternative direction carries at most one clause naming a cost's kind: count the costs named and check none has its consequence spelled out — two, or one explained, is the case
- No outcome recorded in the point's own turn — the answer waits for the person's reply
- Every finding you settle rests on what determined it — a decision with its why and what it relies on, a merge into the decision that answers it; one without its derivation needs the person
- No finding moved away from the person but by the raise
- No bare id (`F5`, `T2`) as a label in prose — named by report title or described
- Not reading the report verbatim

If any box is unchecked, stop and reframe.
