# Specification: Webhook Intake

## Specification

### 1. Verification

- Every inbound webhook — a payment gateway's capture events included —
  is verified against the provider's signature before its body is read.
- A delivery that fails verification is rejected with no side effects.

### 2. Deduplication

- Deliveries are deduplicated on the provider's event id; a repeated
  delivery is acknowledged and dropped.

### 3. Acknowledgement

- Every webhook is acknowledged within two seconds; the work a delivery
  triggers, such as marking an order paid on capture, runs after the
  acknowledgement.

---

## Working Notes
