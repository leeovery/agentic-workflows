# E1: Delivery Timing

## Question

What is the p95 capture-webhook delivery latency from the gateway
sandbox? Feeds the checkout wait-window choice.

## Prediction

The vendor claims sub-second delivery; we expect p95 under two
seconds.

## Decision rule

If p95 < 2s across the sample, the checkout waits 3s before the
pending state; if p95 >= 2s, the flow goes pending-first.

## Setup

Fire 50 sandbox captures with the existing checkout harness and
log request-to-webhook latency per event. Instruments: the gateway
sandbox CLI and a timestamp diff script kept with this record.
