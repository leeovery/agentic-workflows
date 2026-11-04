# Feature Continuation

*Reference for **[leeway-bridge](../SKILL.md)***

---

Route a feature to its next pipeline phase.

Feature pipeline: (Experiment) → Discussion → Specification → Implementation → Review

## A. Route

A feature reaches the bridge before its spec, where continuing is the only way forward. Set `route` = `next_route`.

→ Proceed to **B. Hand Off**.

## B. Hand Off

→ Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `{route}`.
