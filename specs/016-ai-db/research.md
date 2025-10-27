# Research: Production DB Protection from Test Contamination

**Feature**: 016-ai-db
**Date**: 2025-10-27
**Purpose**: Resolve technical unknowns and establish implementation approach

## Research Questions

### Q1: How do existing environment variables work in the config system?

**Decision**: Use existing `DB_PATH` and `MGTD_CONFIG_PATH` environment variables

**Rationale**:
- `packages/config/src/index.ts` already implements environment variable handling
- `DB_PATH` is not currently used, but the config system supports it conceptually
- `MGTD_CONFIG_PATH` is used by integration tests to point to temporary config files
- No new mechanism needed - just leverage what exists

**Evidence from codebase**:
```typescript
// packages/config/src/index.ts (existing code)
export const resolveConfigPath = (env: NodeJS.ProcessEnv = process.env): string => {
  const fromEnv = env.MGTD_CONFIG_PATH;
  if (fromEnv && fromEnv.trim().length > 0) {
    return path.resolve(fromEnv);
  }
  return DEFAULT_CONFIG_PATH;
};
```

Integration tests already use this pattern:
```javascript
// packages/cli/test/commands/project/add.test.js (existing pattern)
const env = {
  ...process.env,
  MGTD_CONFIG_PATH: configPath  // Points to temporary test config
};
const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
```

**Alternatives considered**:
- Creating new environment variable names → Rejected: Would add unnecessary complexity
- Modifying config file format → Rejected: Breaking change, not needed
- Using command-line flags only → Rejected: More error-prone for repeated use

---

### Q2: What's the best way to implement a test command wrapper?

**Decision**: Use npm script in root `package.json` that sets environment variables and delegates to CLI

**Rationale**:
- npm scripts are standard tooling, well-understood by developers
- Can set environment variables inline: `DB_PATH=./test-data/test.db pnpm mgtd`
- Works with pnpm workspace commands
- Zero code changes required - pure configuration
- Aligns with existing pattern (`server:dev` already does this for API)

**Example implementation**:
```json
{
  "scripts": {
    "mgtd:test": "DB_PATH=./test-data/test.db pnpm mgtd"
  }
}
```

**Alternatives considered**:
- Bash script wrapper → Rejected: Less portable (Windows), more files to maintain
- Node.js wrapper script → Rejected: Overkill for simple environment variable setting
- Modifying mgtd CLI directly → Rejected: Would complicate CLI code unnecessarily

---

### Q3: How to ensure test database exists before running commands?

**Decision**: Let `mgtd init` handle database creation, document in quickstart

**Rationale**:
- `mgtd init` already creates database if it doesn't exist
- No special logic needed in test wrapper
- First-time setup is documented: `pnpm mgtd:test init -d ./test-data/test.db -f`
- Subsequent commands use existing database

**Alternatives considered**:
- Auto-init in wrapper script → Rejected: Hides initialization, makes debugging harder
- Require manual setup → Current approach: Document it clearly
- Check and create in every command → Rejected: Performance overhead, unnecessary

---

### Q4: How to update CLAUDE.md effectively to prevent AI mistakes?

**Decision**: Add explicit section with examples in CLAUDE.md, place it prominently near top

**Rationale**:
- AI reads CLAUDE.md at start of each session
- Concrete examples are more effective than abstract rules
- Placing safety rules early increases likelihood of following them
- Include both correct and incorrect usage patterns

**Content to add**:
```markdown
## AI Safety: Test Environment Usage (CRITICAL)

**🚨 ABSOLUTE RULE**: When testing or verifying commands, ALWAYS use test wrapper.

✅ **CORRECT** - Use test wrapper:
```bash
pnpm mgtd:test task create -t "Test" --no-editor
pnpm mgtd:test project list
```

❌ **WRONG** - Never use direct mgtd:
```bash
mgtd task create -t "Test"  # DANGER: Modifies production DB
mgtd project list            # DANGER: Reads from production
```

**Why**: `mgtd` defaults to production DB. Test wrapper sets `DB_PATH=./test-data/test.db`.
```

**Alternatives considered**:
- Relying on existing CLAUDE.md section → Insufficient: Already failed once
- Adding only to end of file → Rejected: Less likely to be noticed
- Creating separate AI_SAFETY.md → Rejected: AI might not read multiple files

---

### Q5: Should test wrapper support all mgtd subcommands transparently?

**Decision**: Yes - wrapper passes all arguments through unchanged

**Rationale**:
- Wrapper is just environment variable setting, then delegates to `pnpm mgtd`
- `pnpm mgtd` already supports all subcommands
- No special handling needed per subcommand
- Simpler to understand and maintain

**Example usage** (all work identically):
```bash
pnpm mgtd:test task create -t "Test" --no-editor
pnpm mgtd:test memo create --body "Test memo" --no-editor
pnpm mgtd:test project list --json
pnpm mgtd:test init -d ./custom-test.db -f
```

**Alternatives considered**:
- Per-subcommand wrappers → Rejected: Maintenance burden, user confusion
- Whitelist of allowed commands → Rejected: Would break with new commands

---

## Technology Stack Decisions

### Package Manager: pnpm
- **Already in use**: package.json specifies `"packageManager": "pnpm@9.0.0"`
- **Workspace support**: Handles monorepo with `pnpm --filter`
- **No change needed**: Feature uses existing infrastructure

### Environment Variables: Node.js process.env
- **Already in use**: `packages/config/src/index.ts` reads `process.env`
- **Standard approach**: Works across all platforms
- **Integration test pattern**: Tests already use this mechanism successfully

### Database: SQLite
- **Location (prod)**: `~/.local/share/mgtd/issues.db`
- **Location (test)**: `./test-data/test.db`
- **No changes needed**: Same database technology, just different file path

---

## Implementation Risks & Mitigations

### Risk 1: AI might forget to use test wrapper
**Mitigation**:
- Prominent CLAUDE.md section with examples
- Include in every AI session's context
- Make correct usage obvious and easy

### Risk 2: Test database might not exist on first use
**Mitigation**:
- Document initialization in quickstart.md
- `mgtd init` creates database if missing (existing behavior)
- Error messages should be clear if database doesn't exist

### Risk 3: Developer might set DB_PATH manually while using test wrapper
**Mitigation**:
- Document that wrapper sets DB_PATH automatically
- If user sets DB_PATH, it overrides wrapper's setting (standard shell behavior)
- This is actually a feature - allows testing against custom databases

### Risk 4: Existing tests might break
**Mitigation**:
- Tests already use temporary directories (no regression expected)
- Validation step: Run all tests before and after implementation
- Success criterion SC-007 explicitly requires no test modification

---

## Performance Considerations

### Test Wrapper Overhead
- **Measurement**: npm script execution + environment variable setting
- **Expected**: < 10ms (negligible compared to database operations)
- **Constraint**: Must be < 50ms (per spec)
- **Verification**: Measure with `time` command before/after

### Test Environment Initialization
- **First-time setup**: `pnpm mgtd:test init` creates database
- **Expected**: < 1 second for empty database
- **Constraint**: Must be < 2 seconds (per spec SC-006)
- **Verification**: Time the init command

---

## Dependencies Analysis

### Existing Infrastructure (No Changes Needed)
- ✅ `packages/config/src/index.ts` - Environment variable handling
- ✅ Integration test framework - Already uses env vars correctly
- ✅ `pnpm` workspace commands - Already supports `pnpm mgtd`

### Files Requiring Updates
- 📝 `package.json` (root) - Add `mgtd:test` script (1 line)
- 📝 `CLAUDE.md` - Add AI safety section (~20 lines)

### Files Requiring Verification Only
- ✓ `packages/config/src/index.ts` - Verify env var handling works
- ✓ `packages/cli/test/**/*.test.js` - Run all tests, ensure no regression
- ✓ `packages/api/test/**/*.test.ts` - Run all tests, ensure no regression

---

## Open Questions Resolved

**Q**: Should wrapper initialize test database automatically?
**A**: No - document manual initialization. Keeps wrapper simple, makes setup explicit.

**Q**: Should wrapper validate that test DB exists?
**A**: No - let mgtd commands fail naturally with clear errors. Don't add validation logic to wrapper.

**Q**: Should wrapper prevent access to production DB?
**A**: No - wrapper only sets default to test. User can still override with manual env vars if needed.

**Q**: Should existing `pnpm test` be modified?
**A**: No - integration tests already use temporary directories. No change needed.

---

## Conclusion

All technical unknowns resolved. Implementation approach is clear:

1. **Add one npm script** to root package.json
2. **Update CLAUDE.md** with prominent safety section
3. **Document usage** in quickstart.md
4. **Validate** existing tests still pass

No new dependencies, no code changes, no breaking changes. Pure configuration and documentation update.

**Ready for Phase 1: Design & Contracts**
