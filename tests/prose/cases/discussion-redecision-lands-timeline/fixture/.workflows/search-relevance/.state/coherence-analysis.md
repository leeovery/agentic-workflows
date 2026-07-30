# Coherence Analysis Cache

## Findings

### batch-vs-live-stream
- **Category**: conflict
- **Docs**: behavioural-ranking.md, synonym-handling.md
- **Summary**: synonym expansion consumes a live click-signal stream that behavioural-ranking decided will not be built
- **Target**: synonym-handling
