# `portal state status` reads zero "Recent warnings" against real logs

`internal/state/status.go` (`scanRecentWarnings` / `logEntryQualifies`, `logFieldSeparator = " | "`) still parses the **legacy pipe-delimited** log format, and `cmd/state_status_test.go` + `internal/state/status_test.go` still seed pipe-format lines. Production now writes slog **text** format to `portal.log` (the portal-observability-layer feature), so the health check's warning scan silently matches nothing — `portal state status` reports zero recent warnings regardless of what the daemon actually logged.

This is a latent functional regression in the status command. It is **out of scope for every plan task** of the observability feature (the status *reader* is not the deleted logger and appears in no task's file list) and is **not tracked by any other task**. Recommend a dedicated follow-up to migrate the status reader to parse the slog text format (`<RFC3339Nano> <LEVEL> <component>: <msg> <attrs>`), and update its tests to seed the new format.

Source: review of portal-observability-layer/portal-observability-layer
