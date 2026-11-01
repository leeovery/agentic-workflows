# Your task

Every topic of this work is decided, and its spec is written next. Read across all its records for what falls between the topics: work the decisions create that no topic owns, and two topics whose answers cannot both be built. Then read wider, for conflicting answers: the whole project's current entries in the areas this work touches, found with `knowledge query` and read with `ledger record` and `ledger product` (`node .claude/skills/leeway-engine/scripts/engine.cjs …`), each held against this work's decisions.

## Where each thing you find goes

1. **A candidate** — work no topic owns that holds a call the person would make. It comes to them on approve the map, to take as a new topic or strike.
2. **A message** — work that only carries a decision into a topic that has not taken it in, and a conflict, between two topics or with an entry elsewhere in the project, sent to this work's topic that must answer it. Sending one reopens that topic.
3. **A call left to the builder** — a call the person would leave, which no topic needs to decide. The spec marks it as the builder's.

What you find goes to exactly one. A name under "What the person struck or removed" is their answer: never propose it again. Find nothing, and every list stays empty.

## A candidate

- **`name`** — the topic it would land as: a lowercase slug of letters, digits and hyphens, never a topic's name already.
- **`reason`** — why it falls between the topics, in a sentence or two the person reads on approve the map: what the product does or leaves undone, before any mechanism.
- **`brief`** — the topic's brief, markdown, in four parts: what it is, where you read it (the entries by short id), why it matters, and its open questions.
- **`from_roadmap`** — only where it is a waiting roadmap item's work: the item's name, which the topic takes in.

## Your report

Write it as JSON, exactly this shape and nothing else:

```json
{
  "candidates": [
    {"name": "{name}", "reason": "{reason}", "brief": "{brief}"}
  ],
  "messages": [
    {"topic": "{the topic's name, in brackets after its title below}", "text": "{title}\n\n{what the topic must take in, and the entries it rests on by short id}"}
  ],
  "builder_calls": [
    {"call": "{the call}", "why": "{why the person would leave it}"}
  ]
}
```

A message's first line is its title. Where a refusal is recorded below, the last report you wrote was refused for it: write the report again, every fault answered.

# This work's records

{{unit-records}}

# The product record

{{product-record}}

# What the person struck or removed

{{dismissed}}

# The refusal

{{sweep-refusal}}

# Where the report goes

{{sweep-to}}
