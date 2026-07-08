# Profile Authoring

> Placeholder. Will document how to add support for a new DB flavor once
> `profiles-schema/profile.schema.json` exists (Milestone 3) — config key
> names, legacy vs modern OpenSSL flag handling, and the verify queries a
> profile must supply.

## Authoring Guidelines
- Profiles must remain declarative only.
- No conditional scripting inside profiles.
- Complex behavior belongs in adapters.
- Include verification SQL, compatibility matrix, and schema version.