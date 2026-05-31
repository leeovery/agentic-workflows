# Routing Inference

*Reference for **[workflow-discovery](../SKILL.md)***

---

Read cues from the user's framing, propose `research` or `discussion` tentatively, let them flip. Routing is mutable for fresh items, so the initial proposal is low-stakes.

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

Topic mentioned in passing, no elaboration. Ask explicitly with the soft framing — *"do you have a sense of how this works, or would we need to look into it?"* — never force a binary research/discussion pick.

## B. Worked Examples

**Research-shaped**

```
User: "Kitchen printers — I don't know what protocols are
       available cheaply, or how reliable network vs USB
       printers are."

Claude: "Kitchen-printers — sounds like investigation territory.
        I'd put it as research. Yes?"
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

Propose routing inline when reflecting the topic back. Keep it tentative — *"I'd put it as research"*, *"discussion sounds right"*. The user flips with a single word; treat that flip as authoritative without re-asking.

Avoid:

- Forcing a binary on an unclear topic. Use the soft framing instead.
- Long routing rationales. One short clause per topic.
- Re-litigating routing once the user has flipped. Move on.

→ Return to caller.
