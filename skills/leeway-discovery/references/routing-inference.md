# Routing Inference

*Reference for **[workflow-discovery](../SKILL.md)***

---

Read each topic's cues from how the user framed it across the exploration and infer `research` or `discussion`. The inference rides the proposal to the synthesis gate, where the user sees it and can flip it. Routing is mutable for fresh items, so the read is low-stakes.

## A. Cue Lists

**Research-shaped signals**

- *"I don't know..."* / *"I'm not sure how X works"* / *"What's possible with..."*
- Open feasibility / cost / capability questions
- External dependencies the user hasn't worked through
- Technology, market, or competitor questions

**Discussion-shaped signals**

- The user describes the thing in present tense, with actors and flows (*"operators add items, set prices, control availability"*)
- Standard patterns the user clearly knows (auth, RBAC, payments)
- *"We just need to decide between A and B"*
- Architectural questions where multiple approaches are familiar

**Neutral / unclear**

Topic mentioned in passing, no elaboration — usually not a topic yet ([topic-synthesis.md](topic-synthesis.md) **B**). When it is one, take the nearest cue in the exploration — did the user describe how it should work, or wonder what's possible? — and let the gate check the read.

## B. Worked Examples

**Research-shaped**

```
User: "Kitchen printers — I don't know what protocols are
       available cheaply, or how reliable network vs USB
       printers are."
```

Reads `research` — open capability and reliability questions the user hasn't worked through.

**Discussion-shaped**

```
User: "Menu management — operators add items, set prices,
       control availability windows, mark items unavailable
       when they run out."
```

Reads `discussion` — the user already holds the shape: actors, flows, rules.

**Neutral / unclear**

```
User: "We'll need analytics for the operator."
```

A passing mention. Later turns describing the views the operator needs read `discussion`; wondering what is possible to track reads `research`; neither, and it is not a topic yet.

## C. At the Gate

The inferred routing rides each topic's entry in the proposal file and shows on its row at the synthesis gate — the one place it is put to the user. Nothing is proposed mid-conversation: topics are never named in the loop. A flip arrives as `adjust` (*"Y should be research"*) — apply it as authoritative, never re-asked.

Avoid:

- Long routing rationales. The **Topics Identified** `Why` line is one short clause naming the cue.
- Re-litigating routing once the user has flipped it.

→ Return to caller.
