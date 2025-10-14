# Research: Version Command Implementation

**Feature**: 004-https-github-com
**Date**: 2025-10-14
**Phase**: 0 - Research

## Objective

Research how to implement `--version` / `-v` flags and `version` subcommand in oclif v4.0.0 framework, following existing project patterns and best practices.

## Existing Codebase Patterns

### Command Structure (packages/cli/src/commands/memo/list.ts:1-82)

All commands in this project follow oclif's standard pattern:

```typescript
import { Command, Flags } from '@oclif/core';

export default class MemoList extends Command {
  static summary = 'List captured memos';
  static description = '...';
  static usage = ['<%= command.id %> [options]'];
  static examples = ['$ mgtd memo list'];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(MemoList);
    // ... command logic
  }
}
```

**Key observations**:
- Commands extend `Command` from `@oclif/core`
- Static properties define metadata (summary, description, usage, examples)
- Flags use `Flags.*` methods with `char` for short form
- `run()` method contains execution logic
- `this.log()` for stdout output

### Entry Point (packages/cli/src/index.ts:1-50)

The CLI entry point uses oclif's `run()` function:

```typescript
import { run, flush, Errors } from '@oclif/core';

run(collapsedArgv, import.meta.url)
  .then(async () => { await flush(); })
  .catch(async (error: unknown) => {
    await flush();
    await Errors.handle(error instanceof Error ? error : new Error(String(error)));
  });
```

**Key observations**:
- `run()` handles command routing automatically
- Custom argument normalization for multi-word commands
- No explicit version handling currently exists

### Package Structure (packages/cli/package.json:1-78)

Version is defined in package.json:

```json
{
  "name": "meme-gtd-cli",
  "version": "0.1.0",
  "oclif": {
    "bin": "mgtd",
    "commands": "./dist/commands"
  }
}
```

## oclif Version Handling Research

### Built-in Version Support

oclif v4.0.0 provides `Flags.version()` helper:

```typescript
import { Command, Flags } from '@oclif/core';

export default class MyCommand extends Command {
  static flags = {
    version: Flags.version({char: 'v'})
  };
}
```

However, this only works at the command level, not globally.

### Custom Version Implementation (from oclif/oclif#254)

Two recommended approaches for global version handling:

**Option 1: Lifecycle Hook** (cleaner approach)
```typescript
// hooks/version.ts
export default async function hook() {
  if (['-v', '-V', '--version', 'version'].includes(process.argv[2])) {
    console.log('Your fancy version output here.');
    return process.exit(0);
  }
}
```

**Option 2: Override _version() method**
```typescript
class BaseCommand extends Command {
  _version() {
    this.log('Your fancy version output here.');
    return this.exit(0);
  }
}
```

### Reading package.json at Runtime

Multiple approaches exist:

**Option A: Direct import (if module resolution allows)**
```typescript
import pkg from '../package.json' assert { type: 'json' };
console.log(pkg.version);
```

**Option B: fs-extra (already in dependencies)**
```typescript
import { readJsonSync } from 'fs-extra';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '../package.json');
const pkg = readJsonSync(pkgPath);
console.log(pkg.version);
```

**Option C: Node.js native fs module**
```typescript
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
```

## Implementation Strategy

### For `--version` and `-v` Flags (P1 & P2)

Modify `packages/cli/src/index.ts` to intercept version flags before oclif's `run()`:

```typescript
// Check for version flags early
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  const pkg = readJsonSync(join(__dirname, '../package.json'));
  console.log(pkg.version);
  process.exit(0);
}

// Then run oclif
run(collapsedArgv, import.meta.url)...
```

**Rationale**:
- Intercepts flags before command routing
- Simple and explicit
- Consistent with existing index.ts modification pattern
- No need for hooks infrastructure

### For `version` Subcommand (P3)

Create standard oclif command at `packages/cli/src/commands/version.ts`:

```typescript
export default class Version extends Command {
  static summary = 'Show version and environment information';

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Output version info as JSON'
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Version);
    const pkg = readJsonSync(join(__dirname, '../../package.json'));

    if (flags.json) {
      this.log(JSON.stringify({
        version: pkg.version,
        node: process.version,
        // ... other info
      }, null, 2));
    } else {
      this.log(`mgtd version ${pkg.version}`);
      this.log(`Node.js ${process.version}`);
      // ... other info
    }
  }
}
```

**Rationale**:
- Follows existing command structure pattern
- Supports `--json` flag like other commands (e.g., memo list)
- Can provide extended information beyond simple version number

## Technical Decisions

### Version Source: package.json

**Decision**: Read from `packages/cli/package.json` at runtime using fs-extra

**Alternatives considered**:
1. Hardcode version string → ❌ Requires manual sync
2. Import JSON with assert → ❌ May have module resolution issues in ESM
3. Use environment variable → ❌ Adds build complexity

**Selected approach benefits**:
- fs-extra already in dependencies (no new deps)
- Works reliably with ESM
- Always in sync with package.json

### Flag Interception Point: index.ts

**Decision**: Intercept `--version` / `-v` in index.ts before oclif.run()

**Alternatives considered**:
1. Use oclif hooks → ❌ Adds infrastructure complexity
2. Add flag to every command → ❌ Not scalable, inconsistent
3. Override base Command class → ❌ Requires all commands to extend custom base

**Selected approach benefits**:
- Minimal code change
- Works globally for all contexts
- Explicit and easy to understand
- Follows existing index.ts modification pattern

### Output Format

**Decision**:
- `--version` / `-v` → Simple version number only (e.g., `0.1.0`)
- `version` subcommand → Detailed info with optional `--json`

**Rationale**:
- Matches standard CLI behavior (git, npm, etc.)
- Simple output for quick checks
- Detailed subcommand for troubleshooting

## Performance Considerations

- Reading package.json is synchronous I/O (~1-5ms typical)
- Should easily meet <100ms requirement from spec
- No database or network calls required
- Version check exits immediately (no further processing)

## Edge Cases Identified

1. **Concurrent flags**: `mgtd --version -v` → Both should work, show version once
2. **Version with other flags**: `mgtd memo list --version` → Should show version, not execute list
3. **Missing package.json**: Should fail gracefully with error message
4. **Corrupted package.json**: Should catch JSON parse error

## Dependencies

**New dependencies**: None

**Existing dependencies used**:
- `fs-extra` v11.2.0 (readJsonSync)
- `node:path` (join, dirname)
- `node:url` (fileURLToPath)
- `@oclif/core` v4.0.0 (Command, Flags)

## Testing Strategy

### Unit Tests

Test version command in isolation:
- ✓ Outputs correct version from package.json
- ✓ Supports `--json` flag
- ✓ Handles missing package.json gracefully

### Integration Tests

Test actual CLI execution:
- ✓ `mgtd --version` outputs version
- ✓ `mgtd -v` outputs same version
- ✓ `mgtd version` outputs detailed info
- ✓ `mgtd version --json` outputs valid JSON
- ✓ Exit code 0 on success

### Edge Case Tests

- ✓ `mgtd memo list --version` → shows version
- ✓ `mgtd --version --help` → shows version (version takes precedence)

## References

- oclif v4 documentation: https://oclif.io/docs/
- oclif issue #254: https://github.com/oclif/oclif/issues/254
- Project memo list command: packages/cli/src/commands/memo/list.ts
- Project entry point: packages/cli/src/index.ts
- Feature spec: specs/004-https-github-com/spec.md
