# File-browser alias creation emits no audit breadcrumb

`internal/ui/browser.go` `handleAliasSave` (the shared file-browser "save alias for highlighted dir" `a`-key flow, wired into `cmd/open.go`) is a *third* production alias-mutation site that still uses the un-audited two-step `store.Set(...)` + `store.Save()`; its `AliasSaver` interface exposes only `Load`/`Set`/`Save`. Aliases created this way leave no `aliases: set` breadcrumb in `portal.log`, defeating the spec's "single place per file where the breadcrumb can't be forgotten" guarantee (State-mutation audit trail).

Task 3-5 correctly instrumented the two callers its "Do" list named (`cmd/alias.go`, `internal/tui/model.go`), so this site is outside its literal scope. Recommend a follow-up threading this caller onto the audited `SetAndSave(name, path, "cli")` seam (extend the `AliasSaver` interface + the file-browser mock accordingly).

Source: review of portal-observability-layer/portal-observability-layer
