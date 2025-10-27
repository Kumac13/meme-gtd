# Data Model: Production DB Protection from Test Contamination

**Feature**: 016-ai-db
**Date**: 2025-10-27

## Summary

This feature does not introduce new data models or database schema changes. It uses existing infrastructure:

- Existing database files (SQLite)
- Existing environment variable mechanism
- Existing config loading system

## Existing Data Models Used

### Database Files

**Production Database**:
- **Location**: `~/.local/share/mgtd/issues.db`
- **Schema**: Unchanged - uses existing schema (001_init, 002_add_project_view_meta)
- **Access**: Default when no environment variables set

**Test Database**:
- **Location**: `./test-data/test.db`
- **Schema**: Identical to production - same migrations applied
- **Access**: Used when `DB_PATH` environment variable is set

### Environment Configuration

**Environment Variables** (existing, no changes):
- `DB_PATH`: Optional path to database file
- `MGTD_CONFIG_PATH`: Optional path to config file
- `PORT`: API server port (3000 production, 3001 test)

**Config File** (`~/.config/mgtd/context.json` or temp location):
```json
{
  "dbPath": "/path/to/issues.db",
  "mode": "local",
  "schemaVersion": "002_add_project_view_meta",
  "updatedAt": "2025-10-27T..."
}
```

## No Schema Changes

This feature explicitly avoids database schema changes:
- ✅ No new tables
- ✅ No new columns
- ✅ No new migrations
- ✅ No data model modifications

## Implementation Details

### How Test Environment Works

1. **Test wrapper** sets environment variable:
   ```bash
   DB_PATH=./test-data/test.db pnpm mgtd [command]
   ```

2. **Config system** reads environment:
   ```typescript
   // packages/config/src/index.ts (existing code)
   const dbPath = env.DB_PATH || DEFAULT_CONFIG.dbPath;
   ```

3. **Database operations** use selected path:
   - All repositories read from `config.dbPath`
   - No code changes needed in repositories
   - Works automatically with environment variable

### File System Structure

```
/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/
├── test-data/
│   └── test.db                    # Test database (same schema as production)
└── ~/.local/share/mgtd/
    └── issues.db                  # Production database (unchanged)
```

## Data Isolation

### Production Data Protection

- **Before feature**: AI could accidentally write to `~/.local/share/mgtd/issues.db`
- **After feature**: AI uses wrapper → writes to `./test-data/test.db`
- **Production guarantee**: Zero modifications to production database

### Test Data Isolation

- **Integration tests**: Use temporary directories (existing pattern)
- **Manual testing**: Use `./test-data/test.db` (new pattern via wrapper)
- **API testing**: Use test API server (port 3001, already configured)

## Validation Points

- [ ] Production database file unchanged after implementing feature
- [ ] Test database created successfully on first init
- [ ] Both databases can coexist without interference
- [ ] Schema migrations apply identically to both databases
- [ ] All data operations work correctly in both environments

## References

- **Existing config system**: `packages/config/src/index.ts`
- **Existing database schema**: `schema/001_init.sql`, `schema/002_add_project_view_meta.sql`
- **Specification**: [spec.md](./spec.md)
- **Implementation plan**: [plan.md](./plan.md)
