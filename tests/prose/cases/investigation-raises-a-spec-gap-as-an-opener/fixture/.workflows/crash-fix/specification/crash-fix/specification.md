# Specification: Crash Fix

## Specification

### 1. Scope

- An order with no shippable line items completes checkout through the payment step.
- Orders carrying at least one shippable item are unchanged.

### 2. Tax Context

- For an order with a shipping address, the tax context is built from it, as today.

### 3. Test Coverage

- A digital-only basket is covered end to end through the payment step.

---

## Working Notes
