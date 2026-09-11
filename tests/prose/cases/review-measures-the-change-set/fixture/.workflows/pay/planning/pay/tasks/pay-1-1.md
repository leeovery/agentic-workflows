---
id: pay-1-1
phase: 1
status: completed
created: 2026-01-01
---

# Create Payment Intent

Create a gateway payment intent when checkout begins and attach it to the order.

**Acceptance Criteria**: Intent created on checkout start; card-only enforced; gateway rejection surfaces as a user-visible checkout error; a duplicate start reuses the existing intent.

**Tests**: `creates a card-only intent on checkout start` — rejection path shows the error; duplicate start does not mint a second intent.
