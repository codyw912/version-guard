# Version Guard: User-Visible Hook Signal + Inline Suppression

## Context

### Original Request
- The plugin works, but the user may not have any visual cue that the version-check hook fired.
- Also need a robust way to intentionally pin older versions without getting nagged.

### Interview Summary
**Key Discussions**:
- Add a user-visible indicator when the hook runs and there are **no** warnings.
- Add inline suppression directives so intentional pins can be expressed in-file.

**Confirmed Decisions**:
- OK indicator:
  - Text: `Version Guard: OK`
  - Location: appended to tool output (after the edit/write tool output)
  - Applies to both `edit` and `write`
  - Emitted only when the file is checkable, parsing succeeds, and there are 0 actionable warnings
  - OK should still be emitted even if there are 0 pins (empty file, only ignored tags like `latest`, or all pins suppressed), as long as the check was actually performed and parsing succeeded
- Skipped files (ignored paths, disabled ecosystems, unknown file types) produce no extra output.
- Inline suppression directives:
  - `version-guard: ignore` (same-line only; suppress that dependency)
  - `version-guard: ignore-file` (anywhere in file; suppress entire file)
  - Case-insensitive, flexible whitespace
  - Directives are only recognized inside comments (i.e., after `#`)
  - Suppressed dependencies are completely silent

### Metis Review (Gaps Addressed)
- Inline suppression does not exist today; current ignores are config-based only.
- Suppression should be implemented in parsers (filter pins before registry calls) to avoid unnecessary network traffic.
- Clarified:
  - Parse failures should be silent (no OK line, no parse error line)
  - `ignore` is same-line only
  - Suppression parsing is case-insensitive + whitespace-tolerant

---

## Work Objectives

### Core Objective
Make Version Guard visibly confirm that checks ran, while supporting intentional version pins without noisy warnings.

### Concrete Deliverables
- Inline suppression support in core parsers:
  - Dockerfile / compose parsing
  - Cargo.toml parsing
- A deterministic “checked successfully” signal for OpenCode users:
  - `Version Guard: OK` appended when check ran and found no actionable warnings

### Definition of Done
- Editing or writing a checkable file with no actionable warnings shows `Version Guard: OK` in the tool output.
- Adding `version-guard: ignore` / `version-guard: ignore-file` prevents warnings for intentionally pinned dependencies.
- Existing boxed warning output remains unchanged.
- Unit tests cover suppression behavior.

### Must NOT Have (Guardrails)
- No “skipped” indicators.
- No changes to boxed warning formatting in `formatWarnings()`.
- No “blocking mode” / “warning mode” work in this scope.
- No persistent state (“acknowledge once” across sessions).
- No new config keys for suppression (inline-only).

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (`bun:test`)
- **User wants tests**: Tests-after (unit tests added alongside implementation)
- **Framework**: `bun:test`

### Primary Verification Commands
- `bun test` (repo root)

### Manual Verification (OpenCode)
- Perform a `tool.write` and `tool.edit` on a Dockerfile/Cargo.toml and confirm:
  - If warnings exist: the boxed warnings appear.
  - Deterministic OK case (no registry freshness assumptions):
    - Use `# version-guard: ignore-file` in the file OR use a Docker tag that produces 0 pins like `FROM nginx:latest`.
    - Expected: output includes `Version Guard: OK` because the check ran and parsing succeeded (even with 0 pins).
  - If file is ignored/skipped (e.g. matches `config.ignore`, or ecosystem disabled): no extra Version Guard output.

---

## Task Flow

```
Add parser suppression → Add tests → Add “OK” indicator path → End-to-end OpenCode check
```

---

## TODOs

> Notes:
> - “OK indicator” requires a reliable way to distinguish “no warnings” from “parse failed” and “skipped”.
>   Today `checkVersions()` returns `[]` for multiple reasons.
>
> **Status semantics (MUST be explicit):**
> - Introduce a detailed result contract used by the plugin:
>   - `status: "checked" | "skipped" | "parse_failed"`
>   - `skipReason?: "no_parser" | "ecosystem_disabled"`
> - Definitions:
>   - `checked`: parser found, ecosystem enabled, and parsing completed without throwing (even if 0 pins, all suppressed, or 0 warnings)
>   - `skipped`: no parser found OR ecosystem disabled by config
>   - `parse_failed`: parser found and ecosystem enabled, but parsing threw an exception
> - Plugin behavior:
>   - If `status === "checked"` and `warnings.length === 0` → append `Version Guard: OK`
>   - If `status === "checked"` and `warnings.length > 0` → append boxed warnings
>   - If `status !== "checked"` → append nothing
> - Parse-failure scope (explicit): keep existing `checkVersions()` behavior unchanged; `checkVersionsDetailed()` is the non-throwing API used by the OpenCode plugin.
> - Export wiring: `checkVersionsDetailed` (and its result types) must be exported from `packages/core/src/index.ts:44` so the plugin can import it from `@version-guard/core`.

### 1) Add inline suppression to Docker parser

**What to do**:
- Update `packages/core/src/parsers/docker.ts` to support:
  - File-level directive: `# version-guard: ignore-file` (anywhere in file) → return no pins
  - Line-level directive: `# version-guard: ignore` (same-line only) → skip that pin
- Ensure directive parsing is case-insensitive and whitespace-tolerant.
- Only treat it as a directive if it appears in the comment portion (after `#`), not in the image name/tag.
- Ensure suppression happens before any pins are returned (so downstream registry calls are avoided).

**Must NOT do**:
- Do not add new config options for suppression.
- Do not change the existing docker image regex matching beyond what’s needed for suppression.

**Parallelizable**: YES (with TODO 2)

**References**:
- `packages/core/src/parsers/docker.ts:37` - docker parser entry point
- `packages/core/test/parsers.test.ts:4` - existing docker parser tests pattern

**Acceptance Criteria**:
- New tests in `packages/core/test/parsers.test.ts`:
  - Same-line ignore suppresses a FROM pin
  - Same-line ignore suppresses a compose `image:` pin
  - ignore-file suppresses all pins (Dockerfile)
  - ignore-file suppresses all pins (compose content)
  - Directive is only recognized after `#` (prove no false positive if the string `version-guard: ignore` appears before a `#`)
- `bun test` passes.

### 2) Add inline suppression to Cargo parser

**What to do**:
- Update `packages/core/src/parsers/cargo.ts` to support:
  - `# version-guard: ignore-file` anywhere → return no pins
  - Same-line `# version-guard: ignore` on a dependency line → skip that dependency pin
- Keep existing section-detection behavior unchanged.
- Only treat it as a directive if it appears in the comment portion (after `#`).

**Parallelizable**: YES (with TODO 1)

**References**:
- `packages/core/src/parsers/cargo.ts:34` - cargo parser entry point
- `packages/core/test/parsers.test.ts:71` - existing cargo parser tests pattern

**Acceptance Criteria**:
- New tests in `packages/core/test/parsers.test.ts`:
  - Inline ignore on a dependency line prevents pin creation
  - ignore-file prevents all pins
- `bun test` passes.

### 3) Add a status-aware version check API (to support OK indicator)

**What to do**:
- Introduce a backward-compatible API in core that returns the detailed status contract described above.
  - Example shape: `checkVersionsDetailed(...) -> { warnings: VersionWarning[]; status: "checked" | "skipped" | "parse_failed"; skipReason?: "no_parser" | "ecosystem_disabled" }`
- Define the result types in `packages/core/src/types.ts` (e.g. `CheckStatus`, `SkipReason`, `CheckVersionsResult`) so downstream packages can type against them.
- Export those types from `packages/core/src/index.ts:2` (type export list) and export `checkVersionsDetailed` from `packages/core/src/index.ts:44`.
- Keep the existing `checkVersions(...) -> VersionWarning[]` for callers that don’t need status.
- Ensure parse failures do not throw up to the plugin; they should result in `status="parse_failed"`.
- Ensure ecosystem-disabled is explicitly surfaced as `status="skipped"` with `skipReason="ecosystem_disabled"`.

**Must NOT do**:
- Do not change `formatWarnings()` output.
- Do not introduce blocking/warning modes.

**Parallelizable**: NO (required by TODO 4)

**References**:
- `packages/core/src/checker.ts:55` - current `checkVersions()` logic
- `packages/core/src/checker.ts:106` - current `formatWarnings()`
- `packages/core/src/index.ts:1` - where core types are exported
- `packages/core/src/index.ts:44` - where core checker functions are exported

**Acceptance Criteria**:
- Add a deterministic unit test for `status="parse_failed"`.
  - Recommended approach: allow `checkVersionsDetailed` to accept an optional `parserOverride` (test-only) so tests can pass a parser whose `parse()` throws.
- Add a deterministic unit test for `status="skipped"` + `skipReason="ecosystem_disabled"`.
  - Example: call `checkVersionsDetailed` for a Dockerfile name with `config.docker.enabled=false`.
- `bun test` passes.

### 4) Append `Version Guard: OK` in OpenCode plugin

**What to do**:
- Update `packages/adapters/opencode-plugin/src/config.ts`:
  - Extend `shouldCheck(filePath, config)` to also respect per-ecosystem enablement:
    - If filename matches docker patterns and `config.docker.enabled === false` → return false
    - If filename matches Cargo.toml and `config.cargo.enabled === false` → return false
  - This is required so “disabled ecosystems produce no extra output” holds.
- Update `packages/adapters/opencode-plugin/src/index.ts`:
  - Update the `@version-guard/core` import to use `checkVersionsDetailed` (and keep `formatWarnings`).
  - Use `checkVersionsDetailed` (TODO 3) and follow the status semantics:
    - If `status !== "checked"` → append nothing
    - If `status === "checked"` and `warnings.length > 0` → append boxed warnings
    - If `status === "checked"` and `warnings.length === 0` → append `\n\nVersion Guard: OK`

**Must NOT do**:
- Do not add any “skipped” output when `shouldCheck()` returns false.
- Do not add extra debug output.

**Parallelizable**: NO (depends on TODO 3)

**References**:
- `packages/adapters/opencode-plugin/src/index.ts:31` - hook implementation
- `packages/adapters/opencode-plugin/src/config.ts:32` - `shouldCheck()` gating

**Acceptance Criteria**:
- Manual: edit/write a checkable file with no warnings → tool output includes `Version Guard: OK`.
- Manual: ignored file → no Version Guard output.
- Manual: disable an ecosystem in config (e.g. `docker.enabled=false`) and edit a Dockerfile → no Version Guard output.

### 5) Expand core parser tests for suppression directives

**What to do**:
- Add focused tests to `packages/core/test/parsers.test.ts`.
- Include whitespace/case variants:
  - `# Version-Guard:ignore`
  - `#version-guard: ignore-file`
- Include at least one compose `image:` suppression test (since compose parsing is in scope).
- Include at least one test proving directives only match in the comment portion (after `#`).

**Parallelizable**: YES (with TODO 1/2)

**References**:
- `packages/core/test/parsers.test.ts:1` - bun test style

**Acceptance Criteria**:
- `bun test` passes.

### 6) End-to-end OpenCode verification

**What to do**:
- Use the existing local plugin symlink flow (per repo README) and confirm:
  - Warnings show boxed output
  - No-warnings show `Version Guard: OK`
  - Inline suppression removes warnings

**Parallelizable**: NO

**References**:
- `packages/adapters/opencode-plugin/src/index.ts:31` - where output is appended
- `README.md:Installation` - local plugin linking instructions

**Acceptance Criteria**:
- Demonstrate one Dockerfile edit that results in:
  - Deterministic OK output using either `# version-guard: ignore-file` or a 0-pin case like `FROM nginx:latest`
  - No warnings when `# version-guard: ignore` is present on the dependency line

---

## Commit Strategy
- Prefer small, atomic commits:
  1. `feat(core): add inline suppression directives`
  2. `feat(opencode-plugin): add OK indicator when checked`

---

## Success Criteria
- User-visible confirmation exists for successful checks.
- Intentional pins can be expressed in-file without noisy output.
- Tests pass: `bun test`.
