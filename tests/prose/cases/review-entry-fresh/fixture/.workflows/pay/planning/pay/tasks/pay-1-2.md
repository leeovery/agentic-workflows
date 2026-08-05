---
id: pay-1-2
phase: 1
status: completed
created: 2026-01-01
---

# Handle Capture Webhooks

Consume gateway capture webhooks and mark the order paid; no polling path.

**Acceptance Criteria**: The webhook consumer marks the order paid; duplicate deliveries are idempotent; no polling path exists anywhere.

**Tests**: `marks the order paid on capture webhook` — duplicates are idempotent; an unknown intent is logged and ignored.
