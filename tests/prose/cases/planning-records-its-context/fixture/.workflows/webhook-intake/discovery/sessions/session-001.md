# Discovery Session 001

Date: 2026-01-01
Work unit: webhook-intake

## Description (as of session)

One standard for every inbound provider webhook.

## Seed

(none)

## Imports

(none)

## Map State at Start

(n/a — single-topic work)

## Exploration

Every service consumes provider webhooks its own way — some verify
signatures and some do not, and a retried delivery can apply twice.
Shaped as a cross-cutting concern: one intake standard every webhook
consumer follows — verification, deduplication, prompt
acknowledgement — rather than a fix to any one consumer.

## Edits

(none)

## Topics Identified

(none)

## Conclusion

(none)
