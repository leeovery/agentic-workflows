# Research: Pay

Accept card payments at checkout using the existing gateway account.
Card-only for v1; what the existing account can and cannot do at the
checkout is what this research explores before anything is decided.

## Starting Point

What we knew going in:
- The shop already holds a gateway account; it is the assumed home
  for card payments.
- Card-only for v1 — wallet support was set aside when the work was
  shaped.
- Nobody knew whether the account supports hosted card fields, what
  strong customer authentication adds to the checkout, or whether a
  second provider is worth pricing.

---

## Gateway Capabilities

The existing account exposes a tokenisation API: the browser posts
card details to the gateway and gets a single-use token back, so our
servers hold a token and never a card number. Whether the account
also offers hosted card fields — the gateway rendering the card
inputs inside our page, so the details never pass through our
front-end code either — turns on the account's plan tier, and the
plan documentation is silent on it.

## Checkout Flow Under Consideration

Card details entered on our checkout page, tokenised in the browser,
the token sent with the order, capture confirmed back to us by the
gateway. Everything downstream of the token is unchanged from the
current order flow.

## Strong Customer Authentication

Whether the shop's markets require a challenge step on card payments,
and what that step does to the checkout, has not been looked at.

## Fallback Provider

A second gateway for declines has been raised as a question and not
explored: what it would cost to onboard, and whether declines are
frequent enough to justify it, are both unknown.
