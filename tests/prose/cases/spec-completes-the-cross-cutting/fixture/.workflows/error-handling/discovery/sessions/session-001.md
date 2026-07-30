# Discovery Session 001

Date: 2026-01-01
Work unit: error-handling

## Description (as of session)

Standardise error handling across services.

## Seed

(none)

## Imports

(none)

## Map State at Start

(n/a — single-topic work)

## Exploration

Every service shapes its errors differently, so callers branch on
shapes instead of meanings and retry logic is guesswork. Shaped as
a cross-cutting concern: define one error contract for all
services — an envelope, a retryable/terminal classification, and
boundary logging — rather than change any one service. The
standard is the deliverable; adoption lands per-service later.

## Edits

(none)

## Topics Identified

(none)

## Conclusion

(none)
