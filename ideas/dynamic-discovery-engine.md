# Dynamic Discovery Engine

## The Idea

Replace the 7+ bespoke JavaScript discovery scripts with a single generic discovery engine driven by per-skill JSON schema definitions. Each skill declares what data it needs from the manifest, and the engine extracts it dynamically at runtime.

## Why This Matters

Every entry-point and phase-entry skill has its own discovery script that reads the manifest and interprets state. When the manifest schema changes (new fields, renamed statuses, new phases), every script must be updated manually. Miss one and you get bugs.

## How It Would Work

**One engine, many schemas.** A single discovery engine (Node.js) reads the manifest and applies a per-skill schema to extract the relevant data. Each skill has a small JSON schema file declaring what it needs:

```json
{
  "work_units": {
    "filter": { "work_type": "feature", "status": "in-progress" },
    "include": ["current_phase", "phase_status", "next_available_phase", "topic_status"]
  }
}
```

The engine resolves these declarations against the manifest and returns structured JSON. The skill's entry-point parses the result as it does now — but the extraction logic is centralised.

**To change what a skill receives:** edit its schema JSON file. No JavaScript changes needed.

**To change the manifest structure:** update the engine's mapping layer. All skills automatically get the updated data shape.

## Design Tension

Some discovery logic involves complex conditionals (epic phase navigation, soft gate evaluation). The schema would need to be expressive enough for these cases or provide an escape hatch for custom logic. The goal is to cover the common extraction patterns centrally while allowing overrides where needed.
