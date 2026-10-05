# Specification: Behavioural Ranking

## Specification

### 1. Signal Ingestion

- Click and purchase events reach ranking features through a
  nightly batch aggregation job over the events pipeline.

### 2. Ranking Features

- The nightly job writes one behavioural score per catalogue item.
