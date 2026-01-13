# version-guard

A cross-harness version pin warning tool. Detects outdated package versions in Dockerfiles, Cargo.toml, and other dependency files when AI agents edit them.

**Non-blocking**: Warnings are informational. Does not prevent edits.

## Supported Ecosystems

| Ecosystem | Files | Registry |
|-----------|-------|----------|
| Docker | `Dockerfile*`, `*compose*.yml` | Docker Hub |
| Cargo | `Cargo.toml` | crates.io |

## Installation

### OpenCode Plugin

```bash
# Clone and build
git clone https://github.com/codyw912/version-guard
cd version-guard
bun install && bun run build

# Link to OpenCode plugins
mkdir -p ~/.config/opencode/plugin
ln -sf $(pwd)/packages/adapters/opencode-plugin/dist/index.js ~/.config/opencode/plugin/version-guard.js
```

### CLI

```bash
# Check a file directly
bun run packages/cli/src/index.ts Dockerfile

# Use with hooks (stdin mode)
echo '{"tool":"write","args":{"filePath":"Dockerfile","content":"FROM nginx:1.25.3"}}' | bun run packages/cli/src/index.ts --stdin
```

## Example Output

```
+------------------------------------------------------------------+
| Version Guard: 3 outdated packages found
+------------------------------------------------------------------+

  Dockerfile
    :1  library/nginx = "1.25.3" -> 1.27.0 (minor)
    :2  library/postgres = "16.1-alpine" -> 16.6 (patch)

  Cargo.toml
    :7  serde = "1.0.193" -> 1.0.215 (patch)
    :8  tokio = "1.35.0" -> 1.43.0 (minor)

+------------------------------------------------------------------+
```

## Configuration

Create `opencode.json` in your project root:

```json
{
  "opencode-version-guard": {
    "enabled": true,
    "docker": {
      "enabled": true,
      "ignoreTags": ["latest", "dev", "nightly"],
      "ignoreImages": ["my-internal-image"]
    },
    "cargo": {
      "enabled": true,
      "ignoreCrates": ["my-internal-crate"]
    },
    "cache": {
      "ttlMinutes": 10
    }
  }
}
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build all packages
bun run build

# Lint
bun run lint

# Format
bun run format
```

## Architecture

```
packages/
  core/                 # Parsers, registries, cache, semver utils
  cli/                  # Standalone CLI for hooks
  adapters/
    opencode-plugin/    # Native OpenCode plugin
```

## License

MIT
