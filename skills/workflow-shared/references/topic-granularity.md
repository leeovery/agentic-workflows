# Topic Granularity

*Shared reference. Loaded by `workflow-discovery/references/topic-synthesis.md`, `workflow-shared/references/research-analysis.md`, `workflow-shared/references/discovery-gap-analysis.md`, and `workflow-legacy-research-split/references/dialog.md`.*

---

Granularity matters: each topic becomes a separate downstream item with its own artifacts and scaffolding. Narrow topics create overhead and artificially constrain work that naturally wants to cross boundaries. Let the source's actual structure dictate the count — don't anchor to a target number.

## The independence test

If working on topic A would constantly require referencing topic B, they belong together. Topics sharing the same domain, data model, user journey, or decision space should merge.

## Anti-pattern — one topic per implementation concern within one domain

A source surfacing API authentication, password hashing, session management, OAuth integration, token refresh, and rate limiting is NOT six topics. Same user, same security boundary, same session lifecycle — one topic: `auth`.

## Anti-pattern — one topic per system component

A source surfacing pipeline ingestion, schema validation, transformation rules, error handling, retry logic, and dead-letter queues is NOT six topics. Each is a stage in the same pipeline — one topic: `data-pipeline`.

## When to split

Topics have genuinely different stakeholders, concerns, or decision spaces that can be explored independently.

## Framing is input, not a verdict

How the source carved the material — a user's mid-conversation "split them", a document's own section boundaries — informs the test, never answers it. Apply the independence test to the substance at synthesis time; where its shape disagrees with the framing, propose the test's shape — the confirmation gate downstream is where a genuine override lands, with the proposal in view.

→ Return to caller.
