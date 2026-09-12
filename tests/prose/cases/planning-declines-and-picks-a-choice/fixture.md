A feature whose plan stands mid-review. The plan is authored and
graphed; cycle 1's traceability review wrote its tracking file and the
session died before any finding was walked, so both findings sit
Pending under an in-progress tracking entry.

The tracking file stages finding 1 as settled — the capture task gains
the rule that a repeat delivery changes nothing — and finding 2 as a
choice: what the customer is shown between pressing pay and the capture
webhook landing. The specification decides that duplicate webhook
deliveries are idempotent and that capture is confirmed by webhook,
never by polling; neither it, the discussion, nor the plan says what
the customer sees while capture is pending.

The context was cleared between sittings — this session opens cold at
the planning entry skill with the plan in progress and what is on disk.
