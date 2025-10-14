# Implementation Quickstart: Version Command

**Feature**: 004-https-github-com
**Created**: 2025-10-14
**Prerequisites**: Phase 0 (research.md) and Phase 1 (data-model.md, contracts/) completed

## Overview

This guide provides a step-by-step implementation plan for adding version command functionality to the mgtd CLI. The implementation is divided into three priorities matching the spec.md user stories.

## Prerequisites

**Required Reading**:
- [spec.md](./spec.md) - Feature requirements
- [research.md](./research.md) - Technical approach
- [contracts/cli-command.md](./contracts/cli-command.md) - Command specifications

**Development Environment**:
- Node.js v20.18.3+ (target: >=22.0.0)
- pnpm workspace
- Existing mgtd CLI codebase

**Key Dependencies** (already installed):
- @oclif/core v4.0.0
- fs-extra v11.2.0
- Node.js test runner

## Implementation Phases

### Phase 0: Document Version Management Strategy (P1 - MVP)

**User Story**: プロジェクトにバージョン管理方針を文書化

**Files to Create**:
- `docs/versioning.md` (新規作成)

**Implementation Steps**:

1. **docs/ ディレクトリが存在するか確認**:
   ```bash
   ls -la docs/
   ```

   **存在しない場合**: ディレクトリを作成
   ```bash
   mkdir -p docs
   ```

2. **バージョン管理ドキュメント作成** (docs/versioning.md):

   以下の内容を含める：
   - Fixed Versioning採用の理由
   - SemVerルール（MAJOR/MINOR/PATCH）と具体例
   - リリースプロセスの手順（コマンド付き）
   - gitタグの命名規則
   - CHANGELOG管理方法
   - 自動化ツールを使わない理由

   **テンプレート内容**: spec.mdの「Version Management Strategy」セクションをベースに作成

3. **READMEへのリンク追加** (README.md):
   ```markdown
   ## Development

   ### Version Management

   See [docs/versioning.md](./docs/versioning.md) for version management strategy and release process.
   ```

4. **検証**:
   ```bash
   # ドキュメントが存在するか
   ls -la docs/versioning.md

   # 内容を確認
   cat docs/versioning.md | grep -E "(Fixed Versioning|SemVer|Release Process)"
   ```

**Success Criteria**:
- ✅ docs/versioning.md が作成されている
- ✅ Fixed Versioningの説明が含まれている
- ✅ SemVerルールが具体例付きで記載されている
- ✅ リリースプロセスの手順が記載されている
- ✅ gitタグ命名規則が明示されている
- ✅ README.mdからリンクされている

**Commit Message**:
```
docs: add version management strategy documentation

Document Fixed Versioning approach, SemVer rules, release process,
and git tagging convention for the project. This addresses the
"versionをどのように管理するかの検討" requirement from Issue #5.

Related: specs/004-https-github-com/spec.md (FR-011 to FR-015)
```

---

### Phase 1: Basic --version Flag (P1 - MVP)

**User Story**: Display version with `mgtd --version`

**Files to Modify**:
- `packages/cli/src/index.ts`

**Implementation Steps**:

1. **Add version reading utility** (top of index.ts):
   ```typescript
   import { readJsonSync } from 'fs-extra';
   import { join, dirname } from 'node:path';
   import { fileURLToPath } from 'node:url';

   const __dirname = dirname(fileURLToPath(import.meta.url));
   const pkgPath = join(__dirname, '../package.json');
   ```

2. **Intercept --version flag** (before `run()` call):
   ```typescript
   // Handle version flag before oclif routing
   if (process.argv.includes('--version')) {
     try {
       const pkg = readJsonSync(pkgPath);
       console.log(pkg.version);
       process.exit(0);
     } catch (error) {
       console.error('Error: Could not read package.json');
       process.exit(1);
     }
   }
   ```

3. **Test manually**:
   ```bash
   pnpm --filter meme-gtd-cli build
   node packages/cli/dist/index.js --version
   ```

   **Expected Output**: `0.1.0`

4. **Test with other commands**:
   ```bash
   node packages/cli/dist/index.js memo list --version
   ```

   **Expected Output**: `0.1.0` (version takes precedence)

**Success Criteria**:
- ✅ `mgtd --version` displays version number
- ✅ Version displayed regardless of other arguments
- ✅ Exit code 0 on success
- ✅ Error handling for missing/corrupted package.json

**Commit Message**:
```
feat: add --version flag support (P1)

Implement basic version display functionality using --version flag.
Version is read from package.json at runtime. Closes issue #5 (P1).

Related: specs/004-https-github-com/spec.md (FR-001, FR-003, FR-004)
```

---

### Phase 2: Short -v Flag (P2)

**User Story**: Display version with `mgtd -v`

**Files to Modify**:
- `packages/cli/src/index.ts` (modify existing version check)

**Implementation Steps**:

1. **Extend version flag check**:
   ```typescript
   // Handle version flag before oclif routing
   if (process.argv.includes('--version') || process.argv.includes('-v')) {
     try {
       const pkg = readJsonSync(pkgPath);
       console.log(pkg.version);
       process.exit(0);
     } catch (error) {
       console.error('Error: Could not read package.json');
       process.exit(1);
     }
   }
   ```

2. **Verify no -v conflicts**:
   ```bash
   # Search for existing -v usage
   grep -r "char: 'v'" packages/cli/src/commands/
   ```

   **Expected**: No existing commands use `-v` short flag

3. **Test manually**:
   ```bash
   pnpm --filter meme-gtd-cli build
   node packages/cli/dist/index.js -v
   ```

   **Expected Output**: `0.1.0`

**Success Criteria**:
- ✅ `mgtd -v` displays same version as `--version`
- ✅ No conflicts with existing command flags
- ✅ Both flags work together: `mgtd -v --version` shows version once

**Commit Message**:
```
feat: add -v short flag for version (P2)

Add -v as shorthand for --version flag. Both flags display
the same version information.

Related: specs/004-https-github-com/spec.md (FR-002)
```

---

### Phase 3: Detailed version Subcommand (P3)

**User Story**: Display detailed version info with `mgtd version`

**Files to Create**:
- `packages/cli/src/commands/version.ts`

**Implementation Steps**:

1. **Create version command** (packages/cli/src/commands/version.ts):
   ```typescript
   import { Command, Flags } from '@oclif/core';
   import { readJsonSync } from 'fs-extra';
   import { join, dirname } from 'node:path';
   import { fileURLToPath } from 'node:url';

   export default class Version extends Command {
     static summary = 'Show version and environment information';
     static description =
       'Display detailed version information including CLI version, Node.js version, and platform details.';
     static usage = ['<%= command.id %> [--json]'];
     static examples = [
       '$ mgtd version',
       '$ mgtd version --json'
     ];

     static flags = {
       json: Flags.boolean({
         char: 'j',
         summary: 'Output version information as JSON',
         description: 'Format the output as JSON for programmatic consumption.',
         default: false
       })
     } as const;

     async run(): Promise<void> {
       const { flags } = await this.parse(Version);

       try {
         const __dirname = dirname(fileURLToPath(import.meta.url));
         const pkgPath = join(__dirname, '../../package.json');
         const pkg = readJsonSync(pkgPath);

         if (flags.json) {
           const versionInfo = {
             version: pkg.version,
             name: pkg.name,
             node: {
               version: process.version,
               required: pkg.engines?.node || 'unknown'
             },
             platform: process.platform,
             arch: process.arch
           };
           this.log(JSON.stringify(versionInfo, null, 2));
         } else {
           this.log(`mgtd version ${pkg.version}`);
           this.log(`Node.js ${process.version}`);
           this.log(`Platform: ${process.platform}-${process.arch}`);
         }
       } catch (error) {
         this.error('Could not read version information', { exit: 1 });
       }
     }
   }
   ```

2. **Build and test**:
   ```bash
   pnpm --filter meme-gtd-cli build
   node packages/cli/dist/index.js version
   ```

   **Expected Output**:
   ```
   mgtd version 0.1.0
   Node.js v20.18.3
   Platform: darwin-arm64
   ```

3. **Test JSON output**:
   ```bash
   node packages/cli/dist/index.js version --json
   ```

   **Expected Output** (formatted JSON):
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

4. **Verify JSON is valid**:
   ```bash
   node packages/cli/dist/index.js version --json | jq .
   ```

   **Expected**: No jq errors, formatted output

**Success Criteria**:
- ✅ `mgtd version` displays detailed info
- ✅ `mgtd version --json` outputs valid JSON
- ✅ JSON includes all required fields (version, name, node, platform, arch)
- ✅ Error handling for missing package.json

**Commit Message**:
```
feat: add version subcommand with detailed info (P3)

Implement `mgtd version` subcommand that displays detailed version
and environment information. Supports --json flag for programmatic
consumption.

Related: specs/004-https-github-com/spec.md (FR-007, FR-008)
```

---

## Testing Implementation

**Test File**: `packages/cli/test/commands/version.test.js`

**Test Structure**:
```javascript
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const CLI_PATH = './packages/cli/dist/index.js';

describe('version command', () => {
  before(() => {
    // Ensure CLI is built
    execSync('pnpm --filter meme-gtd-cli build', { stdio: 'ignore' });
  });

  it('displays version with --version flag', () => {
    const output = execSync(`node ${CLI_PATH} --version`, { encoding: 'utf-8' });
    assert.match(output, /^\d+\.\d+\.\d+/);
  });

  it('displays version with -v flag', () => {
    const output = execSync(`node ${CLI_PATH} -v`, { encoding: 'utf-8' });
    assert.match(output, /^\d+\.\d+\.\d+/);
  });

  it('displays detailed info with version subcommand', () => {
    const output = execSync(`node ${CLI_PATH} version`, { encoding: 'utf-8' });
    assert.match(output, /mgtd version \d+\.\d+\.\d+/);
    assert.match(output, /Node\.js v\d+/);
    assert.match(output, /Platform:/);
  });

  it('outputs valid JSON with --json flag', () => {
    const output = execSync(`node ${CLI_PATH} version --json`, { encoding: 'utf-8' });
    const json = JSON.parse(output);
    assert.ok(json.version);
    assert.ok(json.name);
    assert.ok(json.node.version);
    assert.ok(json.platform);
    assert.ok(json.arch);
  });

  it('prioritizes version flag over other commands', () => {
    const output = execSync(`node ${CLI_PATH} memo list --version`, { encoding: 'utf-8' });
    assert.match(output, /^\d+\.\d+\.\d+/);
  });
});
```

**Run Tests**:
```bash
node --test packages/cli/test/commands/version.test.js
```

**Expected Output**: All tests passing

---

## Performance Validation

**Requirement**: Version display must complete in <100ms (FR-010)

**Validation Script**:
```bash
# Run 10 times and measure average
for i in {1..10}; do
  time node packages/cli/dist/index.js --version
done
```

**Expected**: All runs complete in <100ms

---

## Common Issues and Solutions

### Issue 1: "Cannot find module package.json"

**Symptom**: Error when running version command

**Cause**: Incorrect path resolution

**Solution**: Verify dist/ directory structure after build:
```bash
ls -la packages/cli/dist/
ls -la packages/cli/package.json
```

Ensure package.json is in the correct relative location from dist/index.js

### Issue 2: ESM import.meta.url issues

**Symptom**: `import.meta.url is undefined`

**Cause**: Non-ESM context

**Solution**: Verify package.json has `"type": "module"` or use appropriate file extension (.mjs)

### Issue 3: Version flag not intercepting

**Symptom**: `mgtd memo list --version` runs memo list instead of showing version

**Cause**: Interception code placed after oclif.run()

**Solution**: Move version check BEFORE oclif.run() call in index.ts

---

## Verification Checklist

Before marking implementation complete:

**Phase 0 - Documentation**:
- [ ] docs/versioning.md が作成されている
- [ ] Fixed Versioningの説明が含まれている
- [ ] SemVerルールが具体例付きで記載されている
- [ ] リリースプロセスの手順が記載されている
- [ ] gitタグ命名規則が明示されている
- [ ] CHANGELOG管理方法が説明されている
- [ ] README.mdからリンクされている

**Phase 1 - Basic --version Flag**:
- [ ] `mgtd --version` displays version number
- [ ] Version takes precedence over other commands
- [ ] Exit code 0 on success, 1 on error
- [ ] Error handling for missing package.json

**Phase 2 - Short -v Flag**:
- [ ] `mgtd -v` displays same output as `--version`
- [ ] No conflicts with existing command flags
- [ ] Both flags work independently and together

**Phase 3 - version Subcommand**:
- [ ] `mgtd version` displays detailed multi-line info
- [ ] `mgtd version --json` outputs valid JSON
- [ ] JSON includes all required fields
- [ ] Follows existing command structure pattern

**Testing**:
- [ ] All integration tests pass
- [ ] Performance under 100ms
- [ ] Edge cases handled (missing file, corrupted JSON)

**Documentation**:
- [ ] Commit messages reference spec.md sections
- [ ] Code comments explain non-obvious choices
- [ ] Examples in command description work correctly

---

## Next Steps

After implementation:

1. **Run full test suite**:
   ```bash
   pnpm --filter meme-gtd-cli test
   ```

2. **Manual verification**:
   ```bash
   pnpm --filter meme-gtd-cli build
   ./packages/cli/dist/index.js --version
   ./packages/cli/dist/index.js -v
   ./packages/cli/dist/index.js version
   ./packages/cli/dist/index.js version --json
   ```

3. **Proceed to /speckit.tasks**:
   Generate tasks.md with implementation checklist

4. **Proceed to /speckit.implement**:
   Execute implementation plan with automated task tracking

---

## Reference Implementation

For similar patterns in the codebase, see:
- **Command structure**: `packages/cli/src/commands/memo/list.ts`
- **Flag handling**: `packages/cli/src/commands/memo/list.ts` (--json flag)
- **Entry point**: `packages/cli/src/index.ts` (existing multi-word command handling)
- **Error handling**: `packages/cli/src/index.ts` (Errors.handle pattern)

---

## Estimated Effort

- **Phase 0 (Documentation)**: ~45 minutes
- **Phase 1 (--version)**: ~30 minutes
- **Phase 2 (-v)**: ~10 minutes
- **Phase 3 (version subcommand)**: ~45 minutes
- **Testing**: ~30 minutes
- **Total**: ~2.5 hours

---

## Success Metrics

Implementation is complete when:
- ✅ バージョン管理ドキュメント（docs/versioning.md）が作成され、READMEからリンクされている
- ✅ All 4 priorities (P1: docs & --version, P2: -v, P3: version subcommand) implemented
- ✅ All tests passing
- ✅ Performance requirement met (<100ms)
- ✅ Error handling verified
- ✅ Manual verification successful
- ✅ Commits reference feature spec
