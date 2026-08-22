# Discovery Session 001

Date: 2026-01-01
Work unit: crash-fix

## Description (as of session)

Checkout crashes when an order has no shipping address.

## Seed

(none)

## Imports

(none)

## Map State at Start

(n/a — single-topic work)

## Exploration

Reported by two users this week: the checkout page 500s at the
payment step for orders with no shipping address. Reproducible on
staging with a digital-only basket. No error surfaces to the user —
the page just fails. Confirmed as a bugfix; no design question here,
so it routes straight to investigation.

## Edits

(none)

## Topics Identified

(none)

## Conclusion

(none)
