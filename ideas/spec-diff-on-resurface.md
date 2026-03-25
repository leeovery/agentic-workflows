# Diff View for Specification Resurfacing

## The Idea

When spec review findings trigger changes to already-approved sections, show a diff instead of re-presenting the entire section.

## Why This Matters

In the specification phase, if extracting a new topic reveals something that affects a previously-approved topic, the system "resurfaces" it — re-presenting the content for re-approval. Currently this means showing the full section text again, which is noisy when only a sentence changed.

For large specs with many topics, resurfacing can feel like Groundhog Day — approving the same content repeatedly with minor tweaks buried in paragraphs of unchanged text.

## What It Would Look Like

```
Resurfacing: Authentication Flow

Changes triggered by: Session Management extraction
revealed shared token refresh logic

  - Added: "Token refresh must use the same validation
    pipeline as initial authentication (see Session Management)"
  + Changed: "JWT expiry" → "JWT expiry (15min access, 7d refresh)"

  Context: 2 of 14 lines changed

Approve changes? (y/n/view full)
```

The user sees exactly what changed, can approve quickly, or expand to full context if needed.

## Implementation

The spec skill already tracks section content for resurfacing. Adding a simple diff (before/after comparison) at the presentation layer would give users the information they need without the noise.
