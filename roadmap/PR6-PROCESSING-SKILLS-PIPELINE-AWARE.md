# PR 6: Processing Skills Pipeline-Aware

*Part of the [Implementation Index](IMPLEMENTATION-INDEX.md). Design context in [WORK-TYPE-ARCHITECTURE-DISCUSSION.md](archive/WORK-TYPE-ARCHITECTURE-DISCUSSION.md) (lines 637-645).*

## Summary

Remove the "workflow-agnostic" constraint from processing skills. They can assume pipeline context exists — work_type is set, prior phases are complete, artifacts are in expected locations.

## Why

CLAUDE.md currently mandates that processing skills never reference specific workflow phases. The idea was that custom entry-point skills could invoke processing skills with any handoff contract. In practice, processing skills are tightly coupled to the workflow's file structure, manifest state, and phase ordering. The "agnostic" design adds awkward dual-path language without enabling meaningful reuse.

## Changes

- Processing skills assume pipeline context
- Remove "if work_type is not set" standalone branches
- Remove dual-path language ("use the spec provided OR look here") — just reference the canonical path
- Update CLAUDE.md to remove the "keeping processing skills workflow-agnostic" section
- Cleaner instructions, less ambiguity

## Dependencies

- Depends on: PR 5 (phase skills are internal, guaranteeing pipeline context)
- This is the final PR in the sequence
