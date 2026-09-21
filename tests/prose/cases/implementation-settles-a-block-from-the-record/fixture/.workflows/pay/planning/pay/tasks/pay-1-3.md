---
id: pay-1-3
phase: 1
status: pending
created: 2026-01-01
---

# Release Abandoned Intents

Release the payment intent of a checkout the shopper never came back to.

**Acceptance Criteria**: An abandoned checkout releases its intent at the section's release time; a checkout the shopper returns to inside the window keeps it.

**Tests**: `releases the intent of an abandoned checkout` — a returning shopper inside the window still finds their intent.
