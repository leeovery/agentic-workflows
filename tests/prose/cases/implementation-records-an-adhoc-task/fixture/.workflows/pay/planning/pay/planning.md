# Plan — pay

## Phase 1: Payment core

**Goal**: Checkout creates and confirms card payments against the existing gateway account.

#### Tasks

| Internal ID | Name | Edge Cases |
|-------------|------|------------|
| pay-1-1 | Create Payment Intent | Gateway rejects the intent; duplicate checkout start |
| pay-1-2 | Handle Capture Webhooks | Duplicate webhook delivery; webhook for an unknown intent |
