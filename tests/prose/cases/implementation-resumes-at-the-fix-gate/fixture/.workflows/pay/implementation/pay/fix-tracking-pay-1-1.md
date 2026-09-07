## Attempt 1

ISSUES:
- A second checkout start mints a second payment intent.
  FIX: look up the order's existing intent before creating one, and
  return it when the gateway still reports it open.
  CONFIDENCE: high — the duplicate-start criterion is untested and
  the code path has no lookup at all.

NOTES:
- The card-only enforcement and the rejection path both read correctly.
