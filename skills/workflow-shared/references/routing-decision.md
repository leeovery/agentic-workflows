# Routing Decision

*Shared reference. Loaded by `research-analysis.md` and `discovery-gap-analysis.md`.*

---

Each candidate topic needs a `routing` value of either `discussion` or `research`. This decision determines where the topic enters the pipeline next.

## What each phase does

- **`routing: research`** — the EXPLORE phase. Open-ended investigation of feasibility, market, viability, early ideas. Used when questions still need framing, options aren't clear, or trade-offs haven't surfaced.
- **`routing: discussion`** — the DECIDE phase. Organic conversation that converges on decisions (`pending → exploring → converging → decided`). Used when the material is already developed enough to drive a decision conversation.

## How to decide

Ask: *does this candidate have enough surfaced material that a decision conversation would be productive, or does it need more exploration first?*

Route to **`discussion`** when:
- Questions are well-formed
- Options are visible
- Trade-offs are surfaced
- The user could reasonably make a choice given what's already on the page

Route to **`research`** when:
- The space is still ill-defined
- Feasibility / market / viability aspects are unaddressed
- Options haven't been enumerated
- Forcing a decision now would just bounce back asking for more exploration

## Default lean

When uncertain, prefer **`research`**. It's the lower-cost-to-reverse direction — research can conclude and route forward to discussion at any time; forcing discussion too early just sends the topic back for more research and burns user time.

This default especially applies to candidates extracted from a completed research file (research-analysis) — the file's existence implies the material is at research stage, and an extracted candidate should usually stay at research stage unless it visibly meets the discussion criteria above.

→ Return to caller.
