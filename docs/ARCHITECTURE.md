# Architecture

> Draft — expand as each milestone lands. Source of truth for scope/rationale
> is `Sleepyhead-CLI-Project-Plan.md`; this doc is the implementation-level
> companion once real code exists to describe.

## Layers

- `engine/` — `Step` contract, `StepEngine` (drives validate → execute →
  verify), `WizardState` (persisted, resumable run state), `Logger` (pino).
  UI-agnostic: knows nothing about CLI vs GUI.
- `steps/` — the 9 concrete hardening steps (00 detect-environment through
  08 cleanup-plaintext). Profile-agnostic: reads all DB-flavor-specific
  values from the active profile, never hardcodes a config key name.
- `profiles/` — JSON, schema-validated against `profiles-schema/profile.schema.json`.
- `adapters/` — isolates DB client (MariaDB vs MySQL) and OS/service control
  differences behind interfaces; steps depend only on the abstract adapter. Includes robust Windows environment detection (registry fallbacks, WMI active process lookups via PowerShell) to decouple XAMPP/MariaDB detection from strict service registration.
- `cli/` — commander-based command parsing, inquirer prompts, chalk/ora
  output. Talks to `engine/` exactly the same way a future GUI would.

## Status

- [x] Milestone 1 — Scaffolding (`Step`/`StepEngine`/`WizardState` + fake
      steps proving resume/rollback plumbing)
- [x] Milestone 2 — Detection
- [ ] Milestone 3 — First real profile (MariaDB 10.4 XAMPP)
- [ ] Milestone 4 — Live execution + verification
- [ ] Milestone 5 — Rollback + backups
- [ ] Milestone 6 — Second profile