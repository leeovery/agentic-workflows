# E1: Reformulation Recovery

## Question

What share of zero-result searches recover via an in-session
reformulation that returns results and is clicked? Feeds the
replacement-source choice.

## Prediction

Meaningful recovery — around a fifth of zero-result searches.

## Decision rule

If the recovered share is >= 15%, behaviour-driven expansion is
the leading candidate and the research carries it forward; if
< 15%, the research goes to a curated source.

## Setup

One deterministic pass over logs/search-sessions.log (all 40
zero-result sessions). Instruments: grep/awk over the committed
log.
