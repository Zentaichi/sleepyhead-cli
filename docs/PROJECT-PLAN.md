# Sleepyhead CLI — Project Plan (Pre-Development)

## 1. Project Structure

```
sleepyhead-cli/
├── package.json
├── tsconfig.json                   # required — see §2
├── .eslintrc.cjs
├── .env.example                    # non-secret config only
├── bin/
│   └── sleepyhead-cli.ts                # CLI entrypoint (shebang, calls cli/index)
├── cli/
│   ├── index.ts                     # command parser, routes to actions
│   ├── commands/
│   │   ├── detect.ts                 # `sleepyhead detect`
│   │   ├── harden.ts                 # `sleepyhead harden --profile ...`
│   │   ├── verify.ts                 # `sleepyhead verify`
│   │   ├── rollback.ts               # `sleepyhead rollback`
│   │   └── migrate.ts                # `sleepyhead migrate-tables`
│   ├── prompts/
│   │   ├── confirmStep.ts            # y/n/diff-preview prompt wrapper
│   │   └── selectProfile.ts
│   └── ui/
│       ├── stepRenderer.ts           # spinner/status/log formatting
│       └── diffPrinter.ts            # shows before/after of config edits
├── engine/
│   ├── StepEngine.ts
│   ├── Step.ts
│   ├── WizardState.ts                # persisted run state (JSON, resumable)
│   └── Logger.ts
├── steps/
│   ├── 00-detect-environment.ts      # NEW — XAMPP path, MariaDB version, service name
│   ├── 01-harden-accounts.ts
│   ├── 02-locate-plugin.ts
│   ├── 03-generate-keys.ts
│   ├── 04-encrypt-keyfile.ts
│   ├── 05-write-config.ts
│   ├── 06-soft-launch-verify.ts
│   ├── 07-migrate-tables.ts
│   └── 08-cleanup-plaintext.ts
├── profiles/
│   ├── mariadb-10.4-xampp.json
│   ├── mariadb-10.6.json
│   └── mysql-8.json
├── profiles-schema/
│   └── profile.schema.json
├── adapters/
│   ├── DbAdapter.ts                  # abstract interface
│   ├── MariaDbAdapter.ts
│   ├── MySqlAdapter.ts
│   ├── WindowsServiceAdapter.ts
│   └── EnvironmentDetector.ts        # NEW — finds XAMPP installs, running services
├── util/
│   ├── openssl.ts
│   ├── iniEditor.ts
│   ├── privilege.ts
│   └── backup.ts                     # NEW — snapshot files before mutation
├── test/
│   ├── steps/
│   ├── adapters/
│   └── profiles/
└── docs/
    ├── ARCHITECTURE.md
    └── PROFILE-AUTHORING.md          # how to add support for a new DB flavor
```

Key change from the GUI-era layout: `renderer/` and `preload/` are gone; `cli/` replaces them but talks to the exact same `engine/`, `steps/`, `profiles/`, `adapters/` — confirming those layers were UI-agnostic as intended. A `docs/` folder is added because a scalable, multi-profile tool needs onboarding notes for "how do I add a new database flavor" separate from user-facing docs.

---

## 2. Tech Stack & Dependencies

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js (LTS) | Matches your JS background; full OS access for shelling out to OpenSSL, editing files, controlling services |
| Language | TypeScript (compiled), required | Mandatory, not optional — profiles, step contracts, and adapter interfaces need compile-time checking so a typo'd config key name (e.g. `innodb_encrypt_table` vs `innodb_encrypt_tables`) fails the build instead of silently misconfiguring encryption at runtime. All source under `bin/`, `cli/`, `engine/`, `steps/`, `adapters/`, `util/` is `.ts`; `tsc` compiles to a `dist/` folder for actual execution, and `tsx`/`ts-node` is used for running directly during development |
| CLI parsing | `commander` | Clean subcommand structure (`detect`, `harden`, `verify`, `rollback`) with flags (`--profile`, `--dry-run`, `--yes`) |
| Interactive prompts | `@inquirer/prompts` (or `prompts`) | Confirm/select prompts for step-by-step approval |
| Terminal output | `chalk` + `ora` | Colored status, spinners for long-running steps (table migration, service restart) |
| Diff display | `diff` (npm) + custom printer | Show a readable before/after of `my.ini` changes prior to writing |
| DB connectivity | `mariadb` (npm) for MariaDB; `mysql2` if MySQL 8 support is added | Used for verification queries (`SHOW PLUGINS`, `INNODB_TABLESPACES_ENCRYPTION`), not general app queries |
| INI parsing/editing | `ini` npm package, but see §4 caveat | Needs to preserve comments/ordering — plain `ini` package does not; may need a custom line-based patcher instead |
| Shell execution | Node's built-in `child_process` (`execFile`, not `exec`) | `execFile` avoids shell-injection risk since arguments aren't string-interpolated through a shell |
| Windows service control | `node-windows` or direct `sc`/`net` via `execFile` | Restart/query MariaDB service state |
| Elevation check | Manual (`net session` exit-code trick) or `sudo-prompt`/manifest | Confirm admin rights before running privileged steps |
| Logging | `pino` (JSON structured logs) + `pino-pretty` for terminal | Persistent audit trail — every command run, every file touched, every verify result |
| Schema validation | `ajv` | Validates each profile JSON against `profile.schema.json` before it's ever loaded |
| Testing | `vitest` or `jest` | Unit-test steps against mocked adapters, no real DB/service required |
| Packaging/distribution | `pkg` or `nexe` (optional) | Bundle into a single `.exe` if you want to hand this to a non-Node-savvy admin later |

**Deliberately not using:** Electron (deferred, per earlier decision), any ORM (raw parameterized queries are simpler and more auditable for a handful of verification queries), and no GUI framework at this stage.

---

## 3. Feature Scope & Requirements

### Must-have (v1)
- **Environment detection**: locate XAMPP install path, MariaDB version, config file path, service name/status, and existing `SecureKeys` directory if present.
- **Profile selection**: auto-suggest a profile based on detected MariaDB version; allow manual override.
- **Guided hardening flow**: run steps 1–8 from the manual, each with validate → preview/confirm → execute → verify.
- **Dry-run mode** (`--dry-run`): show every command and file diff that *would* run, without executing anything.
- **Automatic backups**: snapshot `my.ini` and any file about to be overwritten before every mutation (`util/backup.ts`), timestamped, kept in a `./backups/` folder.
- **Resumability**: if the process is interrupted (crash, reboot after service restart), `WizardState` lets `sleepyhead harden --resume` pick up from the last verified step instead of restarting.
- **Rollback command**: `sleepyhead rollback` reverts to the last known-good backup and config state.
- **Verification-gated progression**: no step marking itself "done" without an explicit `verify()` pass (mirrors the manual's "soft launch" principle) — engine refuses to proceed to encrypt-tables=ON until plugin ACTIVE is confirmed.
- **Audit log**: structured log file per run, including timestamps, commands executed, and verification query results.
- **Non-destructive by default**: plaintext key deletion (step 8) requires an explicit separate confirmation, never bundled into the main flow silently.

### Should-have (v1.x)
- **Multiple profile support**: MariaDB 10.6 and MySQL 8 profiles, proving the architecture's scalability claim.
- **`--yes` flag**: skip confirmations for scripted/CI use, but *only* usable after a successful `--dry-run` in the same session (a light guardrail against blind automation).
- **Table migration progress reporting**: row/table counts for step 7 on larger schemas.
- **Config diffing against a "known good" template**: detect drift if `my.ini` was hand-edited after the wizard ran.

### Nice-to-have / later
- GUI front-end (Electron) reusing the same `engine/`/`steps/`/`profiles/` layers via IPC.
- Linux/systemd adapter for non-XAMPP MariaDB installs.
- Remote/unattended mode with a signed profile + pre-approved plan (for fleet deployment across multiple servers).
- Key rotation workflow (generate key ID 2, re-encrypt tables, retire key ID 1).

### Explicitly out of scope for v1
- Automatic detection/repair of unrelated XAMPP misconfigurations (Apache, phpMyAdmin, etc.) — this tool only touches MariaDB/TDE concerns.
- Cloud KMS integration (AWS KMS, Azure Key Vault) — file-based key management only, matching the current manual.
- Multi-user/RBAC within the tool itself — it's an admin-run utility, not a hosted service.

---

## 4. Technical Intricacies & Risks to Design Around

- **Preserving `my.ini` formatting**: Windows INI files often have comments, ordering, and section quirks that a naive `ini` package round-trip can mangle. Likely needs a line-based patcher (regex-targeted key replacement) rather than parse-mutate-serialize, so untouched lines are byte-identical.
- **Shell-injection safety**: all OpenSSL/service calls must use `execFile` with an argument array, never string-concatenated `exec()` — especially important since file paths may come from detection (semi-user-controlled).
- **Elevation timing**: Windows service restarts and writes to `C:\SecureKeys\` need admin rights; check and request elevation **once, up front**, not mid-flow, to avoid a half-completed step if a UAC prompt is denied partway through.
- **Irreversible step protection**: plaintext key deletion and `ALTER TABLE ... ENCRYPTION` (which rewrites data) need distinctly stronger confirmation UX than reversible config edits — the CLI should visually distinguish "safe/reversible" steps from "destructive" ones.
- **Legacy vs modern OpenSSL flag handling**: must detect installed OpenSSL version and warn if it defaults to PBKDF2, since silently succeeding with the wrong flags produces a keyfile MariaDB 10.4 can't read until failure at service start.
- **Service restart failure recovery**: if MariaDB fails to restart after a config write, the wizard should auto-detect this (poll service status / attempt connection) and offer immediate rollback rather than leaving the admin with a down database and a wizard that already exited.
- **Profile schema versioning**: as more profiles get added, `profile.schema.json` should be versioned so older profiles don't silently break when new required fields are introduced.

---

## 5. Suggested Milestones

1. **Scaffolding**: repo, TS config, `Step`/`StepEngine`/`WizardState` with fake steps — prove resume + rollback plumbing.
2. **Detection**: `EnvironmentDetector` + `detect` command — read-only, no mutation, easiest to test safely.
3. **First real profile**: MariaDB 10.4 XAMPP profile + steps 1–8 wired to real adapters, dry-run mode working end-to-end.
4. **Live execution + verification**: remove training wheels, test against a disposable XAMPP VM/snapshot, not a real environment.
5. **Rollback + backups**: implement and deliberately test failure paths (kill the process mid-step, verify resume/rollback both recover correctly).
6. **Second profile**: MariaDB 10.6 or MySQL 8, to validate the scaling claim before calling v1 done.

---

## 6. Open Decisions Before Coding Starts
- Exact INI-editing strategy (custom patcher vs library) — worth a small spike/prototype before committing.
- Where backups and logs live by default (`./backups/`, `./logs/` relative to install, or a fixed `C:\TDEWizard\` data dir).
- Whether `--yes` unattended mode ships in v1 at all, given the destructive-step risk profile.


## 7. Additional Enhancements (Review Feedback)
- Add `doctor`, `report`, and `self-test` commands.
- Add execution lock to prevent concurrent runs.
- Add configuration drift detection before resume.
- Store transactional backup metadata (run ID, hashes, timestamps).
- Record command exit codes, durations, stdout/stderr, Windows error codes.
- Define recovery policy for partial failures and rollback verification.
- Consider future execution pipeline split if StepEngine grows.
- Keep profiles declarative; move logic into adapters.
- Add diagnostics bundle export.
- Plan for future fleet/remote orchestration.
