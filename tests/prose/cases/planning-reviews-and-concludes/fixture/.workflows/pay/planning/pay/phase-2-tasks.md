# Phase 2: Webhook Capture — 1 task

## pay-2-1

### Task 1: Handle Capture Webhooks

**Problem**: Orders are never marked paid without a confirmation path.
**Solution**: Consume gateway capture webhooks and mark the order paid.
**Outcome**: Paid orders reflect capture with no polling anywhere.
