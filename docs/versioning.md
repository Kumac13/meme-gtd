# Version Management Strategy

**Last Updated**: 2025-10-14
**Related Issue**: [#5](https://github.com/Kumac13/meme-gtd/issues/5)

## Overview

This document defines the version management strategy for the meme-gtd project. It covers our versioning approach, semantic versioning rules, release process, and CHANGELOG management.

## Versioning Approach: Fixed Versioning

**Decision**: We adopt **Fixed Versioning** (also known as Unified Versioning) for all packages in this monorepo.

### What is Fixed Versioning?

Fixed Versioning means all packages in the monorepo share the same version number. When any package is updated, all packages are bumped to the same version, regardless of whether they had individual changes.

### Rationale

We chose Fixed Versioning for the following reasons:

1. **Private Packages**: All packages in this monorepo are marked as `private: true` and are not published to npm. They serve only as internal implementation details of the CLI tool.

2. **Tight Coupling**: Packages have密 interdependencies using `workspace:*` protocol, indicating they are designed to work together as a cohesive unit.

3. **Single Artifact**: The project is distributed as a single CLI tool (`mgtd`). Users interact with one unified product, not individual libraries.

4. **Current Practice**: The project is already using unified versioning (all packages at `0.1.0`), so this formalizes existing practice.

5. **Simplicity**: Users and developers only need to track one version number, reducing confusion and simplifying documentation.

### Operational Method

- The version in **root `package.json`** serves as the master version
- During release, all package versions are updated simultaneously
- Users see and refer to only one version number for the entire tool

## Semantic Versioning Rules

We follow **SemVer 2.0.0** (`MAJOR.MINOR.PATCH`) specification:

### Version Number Format

```
MAJOR.MINOR.PATCH
```

### When to Increment

| Change Type | Version Update | Example | Description |
|------------|---------------|---------|-------------|
| **MAJOR** | Breaking Changes | 0.1.1 → 1.0.0 | Incompatible API changes, removes existing functionality |
| **MINOR** | New Features | 0.1.0 → 0.2.0 | Adds functionality in a backward-compatible manner |
| **PATCH** | Bug Fixes | 0.1.0 → 0.1.1 | Backward-compatible bug fixes |

### Concrete Examples

#### MAJOR Version Bump (Breaking Changes)

- Renaming existing command flags (e.g., `--body-file` → `--file`)
- Removing commands or subcommands
- Changing command behavior in incompatible ways
- Modifying output format that breaks existing integrations

**Example**:
```bash
# Before: 1.5.2
mgtd memo create --body-file memo.txt

# After breaking change: 2.0.0
mgtd memo create --file memo.txt  # Flag renamed
```

#### MINOR Version Bump (New Features)

- Adding new commands or subcommands
- Adding new flags (backward-compatible)
- Adding new optional parameters
- Enhancing existing functionality without breaking changes

**Example**:
```bash
# Before: 0.1.0
mgtd memo list

# After feature addition: 0.2.0
mgtd memo list --search "keyword"  # New optional flag added
```

#### PATCH Version Bump (Bug Fixes)

- Fixing bugs
- Updating documentation
- Internal refactoring with no user-visible changes
- Performance improvements

**Example**:
```bash
# Before: 0.1.0 - bug where memo delete fails
mgtd memo delete 5  # Returns error

# After bug fix: 0.1.1
mgtd memo delete 5  # Works correctly
```

### Version 1.0.0 Criteria

We will release version 1.0.0 when:

- Core functionality (init, memo) is stable and well-tested
- Breaking changes have converged (API is stable)
- The tool is ready for production use
- Documentation is complete
- Test coverage is adequate

## Release Process

We use a **manual release process** with the `npm version` command.

### Step-by-Step Release Workflow

```bash
# 1. Determine the new version number based on SemVer rules
#    - Review changes since last release
#    - Decide: patch, minor, or major?

# 2. Update CHANGELOG.md manually
#    - Add new version section with date
#    - Document all changes under appropriate categories
#    - See CHANGELOG Management section below for format

# 3. Update version in root package.json
npm version minor -m "chore: bump version to %s"
# Use: patch, minor, or major depending on changes

# 4. Synchronize version across all packages
pnpm -r exec npm version $(node -p "require('./package.json').version") --no-git-tag-version

# 5. Commit the version changes
git add .
git commit -m "chore: release v0.2.0"

# 6. Create git tag
git tag v0.2.0

# 7. Push to remote (only when explicitly instructed)
git push && git push --tags
```

### Why Manual Process?

We do **not** use automated versioning tools for the following reasons:

| Tool | Why Not Used |
|------|-------------|
| **semantic-release** | Designed for npm publishing with automatic releases. Our packages are private and don't need npm publication. |
| **standard-version** | Requires Conventional Commits format. The cost of enforcing commit conventions outweighs the benefit for this project. |
| **Manual is sufficient** | Current release frequency is low. Manual process provides more control and is well understood by the team. |

### Automation Trade-offs

**Automated tools are great when**:
- Publishing to npm registry
- High release frequency (weekly/daily)
- Large team with strict commit conventions
- Need for automatic CHANGELOG generation

**Manual process works better when**:
- ✅ Private packages (our case)
- ✅ Low release frequency (our case)
- ✅ Small team with flexible workflow (our case)
- ✅ Need for detailed, curated release notes (our case)

We may revisit automation in the future if release frequency increases significantly.

## Git Tagging Convention

### Tag Format

All version tags use the format: **`vMAJOR.MINOR.PATCH`**

The `v` prefix is required for consistency.

### Examples

```bash
v0.1.0    # Initial release
v0.1.1    # Patch release
v0.2.0    # Minor release (new features)
v1.0.0    # Major release (stable API)
v1.1.0    # Minor release after 1.0
v2.0.0    # Major release (breaking changes)
```

### Creating Tags

```bash
# After version bump and commit
git tag v0.2.0

# Verify tag was created
git tag -l

# Push tag to remote (when ready)
git push origin v0.2.0
# Or push all tags:
git push --tags
```

### Tag Best Practices

- Tags should be annotated with release notes (optional but recommended):
  ```bash
  git tag -a v0.2.0 -m "Release v0.2.0: Add version command"
  ```
- Tags should point to the commit that updates CHANGELOG.md and version numbers
- Never delete or move tags after pushing to remote (history should be immutable)

## CHANGELOG Management

We maintain a **manual CHANGELOG** at the root of the repository.

### Format

We follow a simplified version of [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

## X.Y.Z - YYYY-MM-DD

### Breaking Changes
- Description of breaking change
  - Migration instructions for users

### New Features
- Description of new feature
  - Usage examples or notes

### Bug Fixes
- Description of bug fix
  - Context on what was broken

### Tests
- Test additions or updates
```

### Category Descriptions

| Category | Use When | Example |
|----------|----------|---------|
| **Breaking Changes** | Changes that require user action to maintain compatibility | Renamed `--bodyFile` to `--body-file` |
| **New Features** | New functionality added | Added `memo bookmark` command |
| **Bug Fixes** | Corrections to existing behavior | Fixed crash when deleting non-existent memo |
| **Tests** | Test suite improvements | Added E2E tests for completion command |

### Example Entry

```markdown
## 0.2.0 - 2025-10-14

### New Features

- **Version confirmation command**: Implemented functionality to check CLI version
  - `mgtd --version` / `mgtd -v`: Display version number
  - `mgtd version`: Display detailed version information
  - `mgtd version --json`: Output environment information in JSON format

### Tests

- Added integration tests for version command (5 tests)
- Performance validation: all version commands complete in <100ms
```

### Why Manual CHANGELOG?

**Advantages of manual editing**:
- ✅ Detailed explanations possible (better than auto-generated)
- ✅ Can include migration instructions for breaking changes
- ✅ Curated content focuses on user-relevant changes
- ✅ Existing CHANGELOG.md has proven this approach works

**Disadvantages of auto-generation**:
- ❌ Relies heavily on commit message quality
- ❌ May include irrelevant internal changes
- ❌ Less readable than curated notes
- ❌ Requires strict Conventional Commits discipline

## Quick Reference

### When Releasing

1. ✅ Review changes → Determine version type (patch/minor/major)
2. ✅ Update CHANGELOG.md with new section
3. ✅ Run version commands (see Release Process section)
4. ✅ Create git tag with `v` prefix
5. ✅ Push when ready (with `--tags` flag)

### Version Decision Tree

```
Does this introduce breaking changes?
├─ Yes → MAJOR version bump
└─ No → Does this add new features?
    ├─ Yes → MINOR version bump
    └─ No → PATCH version bump
```

### Common Questions

**Q: Do I need to version bump for documentation-only changes?**
A: Generally no. Documentation updates can go directly to main without a version bump. However, if releasing for other reasons, include docs changes in the CHANGELOG.

**Q: What if I'm not sure if a change is breaking?**
A: Ask: "Will existing users need to change their commands/scripts?" If yes, it's breaking. If unsure, discuss with the team or err on the side of a MINOR bump.

**Q: Can I bundle multiple features into one release?**
A: Yes! Version bumps are per-release, not per-feature. Accumulate features on main branch, then release when ready with appropriate version bump.

**Q: Should I version bump during development?**
A: No. Version bumps happen only at release time. Work on features in branches or main, then bump version when releasing.

## References

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Monorepo Versioning Best Practices](https://amarchenko.dev/blog/2023-09-26-versioning/)

## Changelog of This Document

- 2025-10-14: Initial version created for Issue #5
