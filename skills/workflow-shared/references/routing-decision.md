# Routing Decision

*Shared reference. Loaded by `discovery-gap-analysis.md`.*

---

Each candidate topic needs a `routing` value of `research`, `experiment`, or `discussion`. This decision determines where the topic enters the pipeline next.

## What each phase does

- **`routing: research`** — the EXPLORE phase. Open-ended investigation of feasibility, market, viability, early ideas. Used when questions still need framing, options aren't clear, or trade-offs haven't surfaced.
- **`routing: experiment`** — the MEASURE phase. A designed, controlled run against a real system, with the decision rule written before the data. Used when the question is empirical and decision-bearing — no amount of reading or talking answers it.
- **`routing: discussion`** — the DECIDE phase. Organic conversation that converges on decisions (`pending → exploring → converging → decided`). Used when the material is already developed enough to drive a decision conversation.

## How to decide

Ask: *is this candidate answered by reading, by measuring, or by talking?*

Route to **`discussion`** when:
- Questions are well-formed
- Options are visible
- Trade-offs are surfaced
- The user could reasonably make a choice given what's already on the page

Route to **`experiment`** when:
- The question is empirical and decision-bearing — *"which is actually faster?"*, *"does X really happen?"*, *"how often?"*
- A claim or hunch is testable against a real system the user controls
- Artifacts disagree on a point a measurement would settle

Route to **`research`** when:
- The space is still ill-defined
- Feasibility / market / viability aspects are unaddressed
- Options haven't been enumerated
- Forcing a decision now would just bounce back asking for more exploration

## Default lean

When uncertain between research and discussion, prefer **`research`**. It's the lower-cost-to-reverse direction — research can conclude and route forward at any time; forcing discussion too early just sends the topic back for more research and burns user time. Experiment is never the uncertainty default: it earns its routing only when the question is genuinely settled by measurement.

→ Return to caller.
