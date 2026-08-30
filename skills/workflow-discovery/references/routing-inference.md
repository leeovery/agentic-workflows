# Routing Inference

*Reference for **[workflow-discovery](../SKILL.md)***

---

Every topic's routing answers one question: do we answer this by reading, by talking, or by measuring? Read cues from the user's framing, propose `research`, `experiment`, or `discussion` tentatively, let them redirect. Routing is mutable for fresh items, so the initial proposal is low-stakes.

## A. Cue Lists

**Research-shaped signals** — answered by reading and learning:

- *"I don't know..."* / *"I'm not sure how X works"* / *"What's possible with..."*
- Open feasibility / cost / capability questions
- External dependencies the user hasn't worked through
- Technology, market, or competitor questions

**Experiment-shaped signals** — answered by measuring:

- The question is empirical and decision-bearing — *"which is actually faster?"*, *"does X really happen?"*, *"how often?"*
- A claim or hunch testable against a real system the user controls
- A disagreement a measurement would settle
- Numbers already collected hands-on that a decision would now lean on — the cue that they need collecting properly

**Discussion-shaped signals** — answered by talking and deciding:

- The user describes the thing in present tense, with actors and flows (*"operators add items, set prices, control availability"*)
- Standard patterns the user clearly knows (auth, RBAC, payments)
- *"We just need to decide between A and B"*
- Architectural questions where multiple approaches are familiar

**Neutral / unclear**

Topic mentioned in passing, no elaboration. Ask explicitly with the soft framing — *"do you have a sense of how this works, would we need to look into it, or is this something we'd have to measure?"* — never force a pick from the three.

## B. Worked Examples

**Research-shaped**

```
User: "Kitchen printers — I don't know what protocols are
       available cheaply, or how reliable network vs USB
       printers are."

Claude: "Kitchen-printers — sounds like investigation territory.
        I'd put it as research. Yes?"
```

**Experiment-shaped**

```
User: "Print latency — the vendor claims sub-second delivery,
       and the whole flow design hinges on whether that holds
       on our network."

Claude: "Print-latency — that's a claim we'd have to measure
        before deciding anything on it. I'd put it as
        experiment. OK?"
```

**Discussion-shaped**

```
User: "Menu management — operators add items, set prices,
       control availability windows, mark items unavailable
       when they run out."

Claude: "Menu-management — you've got a clear shape in mind.
        Discussion sounds right. OK?"
```

**Neutral / unclear**

```
User: "We'll need analytics for the operator."

Claude: "For analytics — do you have a sense of what views and
        data you need, or is the question more about what's
        possible to track? First would be discussion territory,
        second research."
```

## C. How to Propose

Propose routing inline when reflecting the topic back. Keep it tentative — *"I'd put it as research"*, *"that's one to measure"*, *"discussion sounds right"*. The user redirects with a single word; treat that redirect as authoritative without re-asking.

Avoid:

- Forcing a pick on an unclear topic. Use the soft framing instead.
- Long routing rationales. One short clause per topic.
- Re-litigating routing once the user has redirected. Move on.

→ Return to caller.
