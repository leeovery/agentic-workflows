# Specification: Behavioural Ranking

## Specification

### 1. Signal Ingestion

- Click and purchase events reach ranking features through a
  nightly batch aggregation job over the events pipeline.
- Ranking never reads a live signal stream: the events pipeline
  exposes batch aggregates only, and no streaming layer is built.

### 2. Ranking Features

- The nightly job writes one behavioural score per catalogue item.
- The score combines click-through rate and purchase rate,
  weighted 30/70 in favour of purchases.

---

## Working Notes
