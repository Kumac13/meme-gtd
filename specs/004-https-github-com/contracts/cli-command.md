# CLI Command Contract: Version Display

**Feature**: 004-https-github-com
**Created**: 2025-10-14

## Command Signatures

### Flag-Based Version (P1 & P2)

```bash
mgtd --version
mgtd -v
```

### Subcommand Version (P3)

```bash
mgtd version [--json]
```

---

## 1. Flag-Based Version: `--version`

### Command Signature

```bash
mgtd --version
```

### Arguments

None

### Flags

| Flag | Type | Description |
|------|------|-------------|
| `--version` | boolean | Display CLI version number |

### Behavior

**When**: User runs `mgtd --version` with no other arguments

**Flow**:
1. index.ts intercepts `--version` in process.argv
2. Read package.json synchronously
3. Extract version field
4. Output version string to stdout
5. Exit with code 0

**Example**:
```bash
$ mgtd --version
0.1.0
```

### Interaction with Other Arguments

**Priority**: `--version` takes precedence over all other arguments

**Examples**:
```bash
$ mgtd memo list --version
0.1.0

$ mgtd --version --help
0.1.0

$ mgtd --version memo create
0.1.0
```

**Rationale**: Version checks should always succeed regardless of other arguments

---

## 2. Short Flag Version: `-v`

### Command Signature

```bash
mgtd -v
```

### Arguments

None

### Flags

| Flag | Type | Description |
|------|------|-------------|
| `-v` | boolean | Display CLI version number (short form) |

### Behavior

**Identical to `--version`**: All behavior matches the `--version` flag exactly

**Examples**:
```bash
$ mgtd -v
0.1.0

$ mgtd memo list -v
0.1.0
```

### Backward Compatibility

**Note**: Ensure `-v` does not conflict with existing command short flags

**Verification**: Review all existing commands for `-v` usage

---

## 3. Version Subcommand: `version`

### Command Signature

```bash
mgtd version [--json]
```

### Arguments

None

### Flags

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--json` | `-j` | boolean | false | Output version information as JSON |

### Behavior

#### Plain Text Mode (default)

**When**: Command run without `--json` flag

**Flow**:
1. oclif routes to version command
2. Read package.json
3. Gather process information
4. Format multi-line output
5. Display via this.log()
6. Exit with code 0

**Output Format**:
```
mgtd version <version>
Node.js <node_version>
Platform: <platform>-<arch>
```

**Example**:
```bash
$ mgtd version
mgtd version 0.1.0
Node.js v20.18.3
Platform: darwin-arm64
```

#### JSON Mode (--json)

**When**: Command run with `--json` flag

**Flow**:
1. oclif routes to version command
2. Read package.json
3. Gather process information
4. Format as JSON object
5. Display via this.log()
6. Exit with code 0

**Output Schema**:
```json
{
  "version": "string",
  "name": "string",
  "node": {
    "version": "string",
    "required": "string"
  },
  "platform": "string",
  "arch": "string"
}
```

**Example**:
```bash
$ mgtd version --json
{
  "version": "0.1.0",
  "name": "meme-gtd-cli",
  "node": {
    "version": "v20.18.3",
    "required": ">=22.0.0"
  },
  "platform": "darwin",
  "arch": "arm64"
}
```

---

## Output Messages

### Success Output

| Command | Output | Exit Code |
|---------|--------|-----------|
| `mgtd --version` | `<version>` | 0 |
| `mgtd -v` | `<version>` | 0 |
| `mgtd version` | Multi-line version info | 0 |
| `mgtd version --json` | JSON object | 0 |

### Error Messages

| Scenario | Message | Exit Code |
|----------|---------|-----------|
| Missing package.json | `Error: Could not read package.json` | 1 |
| Invalid package.json | `Error: Invalid package.json format` | 1 |
| Missing version field | `Error: Version information not available` | 1 |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (file read failure, parse error) |

---

## Performance Requirements

**Requirement**: Version display must complete in <100ms (FR-010 from spec.md)

**Expected Performance**:
- File read: ~1-5ms
- JSON parse: <1ms
- Total: <10ms typical

**Rationale**: Synchronous file I/O is fast for small files like package.json

---

## Testing Scenarios

### Integration Tests

1. **Basic --version**: Run `mgtd --version` → outputs version number
2. **Basic -v**: Run `mgtd -v` → outputs same version number
3. **Version subcommand**: Run `mgtd version` → outputs detailed info
4. **JSON output**: Run `mgtd version --json` → valid JSON with all fields
5. **Version precedence**: Run `mgtd memo list --version` → shows version, not list
6. **Multiple flags**: Run `mgtd --version -v` → shows version once
7. **Version with help**: Run `mgtd --version --help` → shows version only

### Error Handling Tests

8. **Missing package.json**: Rename package.json → error message + exit 1
9. **Corrupted JSON**: Break package.json syntax → error message + exit 1
10. **Missing version field**: Remove "version" from package.json → error message + exit 1

### Performance Tests

11. **Speed test**: Run `mgtd --version` 100 times → all <100ms
12. **Cold start**: First run after install → <100ms

### Edge Cases

13. **Empty arguments**: `mgtd --version ""` → shows version
14. **Case sensitivity**: `mgtd --VERSION` → not recognized (let oclif handle)
15. **Double dash**: `mgtd -- --version` → should pass to oclif (no interception)

---

## Backward Compatibility

**Breaking Changes**: None

**New Features**:
- ✅ New `--version` flag
- ✅ New `-v` short flag
- ✅ New `version` subcommand

**Existing Functionality**: No changes to existing commands

**Migration Required**: None

---

## Dependencies

**Runtime Dependencies**:
- `fs-extra` v11.2.0 (readJsonSync)
- `@oclif/core` v4.0.0 (Command, Flags)
- Node.js standard library (path, url, process)

**Build Dependencies**: None

**No New Dependencies**: This feature uses only existing dependencies

---

## Implementation Notes

### File Path Resolution

```typescript
import { readJsonSync } from 'fs-extra';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '../package.json');
const pkg = readJsonSync(pkgPath);
```

**Rationale**: Reliable path resolution in ESM context

### Early Interception Pattern

```typescript
// In index.ts, before oclif.run()
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  const pkg = readJsonSync(pkgPath);
  console.log(pkg.version);
  process.exit(0);
}
```

**Rationale**: Intercept before command routing to ensure global availability

### Standard Command Pattern

```typescript
// In commands/version.ts
export default class Version extends Command {
  static summary = 'Show version and environment information';
  static flags = {
    json: Flags.boolean({ char: 'j', summary: 'Output as JSON' })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Version);
    // ... implementation
  }
}
```

**Rationale**: Consistent with existing command structure (see memo/list.ts)
