# Discovery Session 001

Date: 2026-01-01
Work unit: pay

## Description (as of session)

Accept card payments at checkout.

## Seed

(none)

## Imports

(none)

## Map State at Start

(n/a — single-topic work)

## Exploration

Shaped as a single feature: accept card payments at checkout using
the existing gateway account. One doubt surfaced that talking
cannot settle: the gateway sandbox is suspected of delivering some
capture webhooks twice, and whether idempotent webhook handling is
built for v1 or deferred hangs on how often that actually happens.
A day of sandbox webhook deliveries is exported at
logs/webhooks.log. Routed to experiment to measure it before the
capture-flow discussion.

## Edits

(none)

## Topics Identified

(none)

## Conclusion

(none)
