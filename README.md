# Sleepyhead CLI

A guided CLI tool that hardens MariaDB/MySQL installations with Transparent
Data Encryption (TDE) — starting with XAMPP-bundled MariaDB 10.4. It walks
through the hardening steps from the project's security manual one at a
time: **validate → preview/confirm → execute → verify**, with automatic
backups, resumability, and rollback at every stage.

This is an **admin-run CLI tool**, not a hosted service. See
`Sleepyhead-CLI-Project-Plan.md` for the full architecture rationale,
milestone breakdown, and open decisions — this README covers what's needed
to get the code running and oriented.

## Status

Milestone 1 (Scaffolding) and Milestone 2 (Detection) are complete: the `Step` contract, `StepEngine`,
and `WizardState` exist and are proven. The environment detector now reliably locates XAMPP/MariaDB installations via registry and active process lookups, accurately identifying bare processes vs. services. Real profiles and hardening steps land in later milestones — see `docs/ARCHITECTURE.md` for the live checklist.

Most CLI subcommands below currently exist as stubs that print which
milestone will implement them, except for the completed milestones.

## Requirements

- Node.js LTS (>=18)
- Windows, for the target hardening workflow itself (XAMPP/MariaDB service
  control). The engine and its tests run fine cross-platform, but detection relies on PowerShell (standard on Windows 10/11).

## Setup

```bash
npm install
```

## Common commands

```bash
npm run dev          # run the CLI directly via tsx, e.g.: npm run dev -- detect
npm run build         # compile TypeScript to dist/
npm run lint           # eslint over all .ts sources
npm test               # vitest run — engine + step unit tests
```

## CLI usage (current stubs)

```bash
sleepyhead detect                     # Milestone 2
sleepyhead harden --profile <name>    # Milestone 3
             [--dry-run] [--yes] [--resume]
sleepyhead verify                     # Milestone 4
sleepyhead rollback                   # Milestone 5
sleepyhead migrate-tables             # Milestone 3/4
```

Run `npm run dev -- --help` for the live command list.

## Project layout

See `Sleepyhead-CLI-Project-Plan.md` §1 for the full annotated tree. In
short:

| Folder | Purpose |
|---|---|
| `bin/` | CLI entrypoint (shebang) |
| `cli/` | commander routing, inquirer prompts, terminal output formatting |
| `engine/` | `Step` contract, `StepEngine`, `WizardState`, `Logger` — UI-agnostic |
| `steps/` | The 9 concrete hardening steps (00-detect-environment ... 08-cleanup-plaintext) |
| `profiles/` | Schema-validated JSON, one per supported DB flavor/version |
| `profiles-schema/` | `profile.schema.json` used to validate every profile via ajv |
| `adapters/` | Isolates DB client (mariadb/mysql2) and OS/service-control differences |
| `util/` | `openssl.ts`, `iniEditor.ts`, `privilege.ts`, `backup.ts` |
| `test/` | Unit tests, mirroring `steps/`/`adapters/`/`profiles/` |
| `docs/` | `ARCHITECTURE.md` (implementation-level notes + milestone checklist), `PROFILE-AUTHORING.md` |

## Key design principles (see plan for full detail)

- **Profile-agnostic steps**: step logic never hardcodes a config key name;
  everything DB-flavor-specific comes from the active profile.
- **Verification-gated progression**: no step is marked done without a
  passing `verify()` — e.g. the engine won't proceed to
  `encrypt-tables=ON` until plugin `ACTIVE` is confirmed.
- **Destructive steps are never bundled silently**: plaintext key deletion
  and `ALTER TABLE ... ENCRYPTION` require distinct, explicit confirmation
  beyond the normal step flow.
- **`execFile`, never `exec`**: all OpenSSL/service shell-outs use an
  argument array, since paths may come from environment detection.
- **Dry-run is real**: `--dry-run` stops after `validate()` — nothing is
  executed, only shown.

## Configuration

Copy `.env.example` to `.env` and adjust as needed. It holds non-secret
config only (log level, backup/log/state directory paths) — never put
OpenSSL passphrases, key material, or DB credentials in `.env`.

## Planned Commands
- `sleepyhead doctor` — health diagnostics.
- `sleepyhead report` — export Markdown/HTML/JSON/PDF audit reports.
- `sleepyhead self-test` — verify prerequisites before changes.

## UX Goals
- Show risk level, rollback availability, files changed, elapsed time, and final summary.
- Prefer automatic profile selection with manual override only when needed.
