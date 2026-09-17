# Research: Pay

Accept card payments at checkout using the existing gateway account.
Card-only for v1; what the checkout can and cannot ask of the shopper
is what this research explores before anything is decided.

## Starting Point

The account exposes a tokenisation API: the browser posts card details
to the gateway and gets a single-use token back, so our servers hold a
token and never a card number. Storing that token for a repeat order is
a second thing, and it needs the shopper to agree to it.

## Checkout Flow Under Consideration

Card details entered on our checkout page, tokenised in the browser,
the token sent with the order, capture confirmed back to us by the
gateway. Whether the token is kept afterwards is the open question.

## Storing A Card For Next Time

What the checkout has to show the shopper before it keeps their card —
what is asked, where it sits in the flow, and what the shopper is
agreeing to — has not been looked at.
