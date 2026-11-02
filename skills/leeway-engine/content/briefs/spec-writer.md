# Your task

Write this unit's spec, `spec.md`, at the path under "Where the spec goes": one spec for the whole unit, in sections by area, each assembled from the records below. It is the document the build reads and the person reviews line by line, so every statement says what the product does, for someone building it who has read nothing else.

Where no spec is written yet, write it whole. Where one is, rewrite from what is recorded below, and leave every other line as it stands:

- **Written since your last brief** — what each entry changes.
- **The review's findings** — each review pass's report waiting for you. A `rewrite` finding is yours to make, as it says, from the entries it names; a `gap` or a `fact` finding comes back to you as entries once it is settled, so leave it.
- **The wording agreed** — each change the person agreed on their review of the spec, naming its line: reword the line as it says, citing what it cited.
- **Lines that do not trace** — re-cite each to the entries it comes from, or drop it.
- **The refusal** — the spec you last wrote was refused for it: answer every fault.

A finding the records contradict, or one already answered, you leave, saying why in your status: changing nothing is an answer.

## What a statement says

- **From the records alone.** Each statement comes from the entries it cites: a decision's answer, or a finding. Say what they decided, never more; where the build would meet a detail no entry decides, that is a gap (below), never a line you fill in.
- **The why, where the builder needs it.** Where a statement needs to say why a decision was made, take the why from the decision and from its topic's log. A why written in neither is a gap.
- **Areas chosen by your judgement.** Choose the areas by how the product falls apart for someone building it, never by topic: a topic's entries may feed several areas, and an area draw on several topics.
- **Invariants name their check.** Each invariant — a rule that holds across the product — names the hard check that enforces it: an architecture test, a lint, an import-graph rule. One no check can enforce says so.
- **Canonical assets linked.** Link each canonical asset below from the statement it informs, with a markdown link by its path from the spec's folder, `assets/{file}`.
- **The builder's, only where the matrix made it so.** A statement resting on the person's "don't care" decision — a decision marked `don't care` below — is the builder's, `[builder: {its id}]`. One resting on a call the sweep left to the builder, under "The builder's calls", is the builder's citing the call, `[builder: {its id}]`, as `[builder: call-1]`. No other line is marked the builder's, and `[builder]` alone does not trace: a detail no entry decides is a gap.

## The spec's shape

The engine reads `spec.md` line by line; a spec it cannot read is refused.

- It opens with its title, `# {Title}`. What stands before its first area is its introduction.
- **An area** is `## N. Title`, numbered from 1; **a part** is `### N.M Title`, inside its area. Every heading stands alone, between blank lines.
- **A statement** is a paragraph opening with its number and a space, `N.M.K `, inside its part `### N.M`, numbered from 1 within the part — while numbers are held below, as they say. Every requirement is a numbered statement: a block under a heading that opens no statement is refused, an introduction to an area or a part among them.
- **Blocks** are split on blank lines. A statement owns every block after it up to the next statement, screen or heading: a second paragraph, a list, a fenced block.
- **Never open a block with a number unless it starts a line.** A paragraph opening `3.2.1 ` is a new statement. To refer to one, put its number later in the sentence: `As 3.2.1 says, …`.
- **The source bracket closes the statement**: `[Ab12Cd, Ef34Gh]`, the short ids of the entries it comes from, as the records below give them. It is the statement's last thing, nothing after it, not even a full stop. It closes the statement's last text block: a statement with a list or a second paragraph under it carries its bracket at the end of that last block, never on its first paragraph. A fenced block never holds it.
- **A screen** — what the person sees, drawn — follows the statement it shows: a block opening `Screen` and ending its caption with `:`, its own bracket closing the caption, then the drawing fenced, ```` ```text ````. The caption holds no `.` before its `:`; one that does is not read as a screen.
- **Scenarios** follow their area, under `## N-S. Scenarios for §N`, after the area's last part and before the next area: each a paragraph opening `N.Sk `, numbered from 1, in Given, when, then, closing on the statements it proves in parentheses, `(1.1.1, 1.2.3)` — never a bracket.
- **Never a number another way:** `1.1.1.`, `- 1.1.1` and `**1.1.1**` do not start a line, and every number is given once.

````markdown
# Payments

## 1. Cards

### 1.1 The form

1.1.1 The form takes Visa and Mastercard, and refuses any other card as its number is typed. [Ab12Cd]

1.1.2 The form shows, in order:

- the card's number;
- its expiry. [Ef34Gh, Ij56Kl]

Screen: the form, empty. [Ef34Gh]

```text
Card number  ____
```

## 1-S. Scenarios for §1

1.S1 Given the card form, when an Amex number is typed, then the form refuses it. (1.1.1)
````

## Gaps

A gap is a detail the build would meet that no entry decides, two entries that contradict each other, or a why a statement needs that no record holds. Never decide one, and never ask the person: write the spec around it — leave the statement out, or write what is decided — and hand each gap back in your status, in product terms, with the entries it concerns.

# Where the spec goes

{{spec-to}}

# The records

{{unit-records}}

# The topics' logs

{{topic-logs}}

# Canonical assets

{{canonical-assets}}

# The builder's calls

{{builder-calls}}

# Written since your last brief

{{changed-entries}}

# The review's findings

{{review-findings}}

# The wording agreed

{{wording-changes}}

# The numbers held

{{held-numbers}}

# Lines that do not trace

{{invented-lines}}

# The refusal

{{land-refusal}}
