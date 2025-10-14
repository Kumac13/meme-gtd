# Data Model: Version Command Implementation

**Feature**: 004-https-github-com
**Created**: 2025-10-14

## Overview

This feature does not introduce new data entities or modify any database schema. It only reads metadata from `package.json` and outputs version information to the user.

## Data Sources

### package.json (Read-Only)

**Location**: `packages/cli/package.json`

**Relevant Fields**:
- `version`: String - Semantic version (e.g., "0.1.0")
- `name`: String - Package name ("meme-gtd-cli")
- `engines.node`: String - Node.js version requirement (e.g., ">=22.0.0")

**Access Pattern**: Synchronous file read using `fs-extra.readJsonSync()`

**No Modifications**: This file is never written to by the version command

## Runtime Environment Data

### Process Information (Read-Only)

The `version` subcommand may display runtime environment information:

**Available from Node.js globals**:
- `process.version`: Current Node.js version (e.g., "v20.18.3")
- `process.platform`: Operating system platform (e.g., "darwin", "linux", "win32")
- `process.arch`: CPU architecture (e.g., "x64", "arm64")

**Access Pattern**: Direct property access (no I/O required)

## Data Flow

### Flag-Based Version Display (`--version`, `-v`)

```
User Input (--version)
    ↓
index.ts intercepts argv
    ↓
Read package.json (fs-extra)
    ↓
Extract version field
    ↓
Output to stdout
    ↓
Exit 0
```

**Performance**: Single synchronous file read (~1-5ms)

### Subcommand Version Display (`version`)

```
User Input (version)
    ↓
oclif routes to version command
    ↓
Command.run() executes
    ↓
Read package.json (fs-extra)
    ↓
Read process.* properties
    ↓
Format output (plain text or JSON)
    ↓
Output to stdout via this.log()
    ↓
Exit 0
```

**Performance**: Single file read + trivial property access (~1-5ms)

## Output Data Structures

### Simple Version Output (--version, -v)

**Format**: Plain text, single line

**Example**:
```
0.1.0
```

### Detailed Version Output (version subcommand, plain text)

**Format**: Multi-line plain text

**Example**:
```
mgtd version 0.1.0
Node.js v20.18.3
Platform: darwin-arm64
```

### JSON Version Output (version --json)

**Format**: JSON object

**Schema**:
```json
{
  "version": "string",      // from package.json
  "name": "string",         // from package.json
  "node": {
    "version": "string",    // from process.version
    "required": "string"    // from package.json engines.node
  },
  "platform": "string",     // from process.platform
  "arch": "string"          // from process.arch
}
```

**Example**:
```json
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

## No Schema Changes

This feature requires:
- ❌ No database migrations
- ❌ No new data models
- ❌ No data persistence
- ❌ No configuration changes

This is a pure read-only operation on existing metadata files.

## Error Handling

### Missing package.json

**Condition**: File does not exist at expected path

**Response**:
```
Error: Could not read package.json
```

**Exit Code**: 1

### Corrupted package.json

**Condition**: File exists but is not valid JSON

**Response**:
```
Error: Invalid package.json format
```

**Exit Code**: 1

### Missing version field

**Condition**: package.json exists but lacks "version" field

**Response**:
```
Error: Version information not available
```

**Exit Code**: 1

## No State Management

This feature is stateless:
- No caching required
- No persistence required
- No session data
- No user preferences

Each invocation is independent and reads fresh data from package.json.
