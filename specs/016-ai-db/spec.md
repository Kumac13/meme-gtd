# Feature Specification: Production DB Protection from Test Contamination

**Feature Branch**: `016-ai-db`
**Created**: 2025-10-27
**Status**: Draft
**Input**: User description: "AIによるテスト実行時の本番DB汚染を防ぐ安全機構の実装"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Separate Test Commands from Production Commands (Priority: P1)

As an AI assistant or developer running tests, I need dedicated test command wrappers that automatically use test environment, so that I never accidentally execute production commands during testing.

**Why this priority**: This is the highest priority because production data has already been lost once when AI executed production commands during testing. AI and tests must never use the same command path as production.

**Independent Test**: Can be tested by running `pnpm mgtd:test task create -t "Test"` and verifying it uses test-data/test.db, while regular `mgtd task create` continues to use production DB.

**Acceptance Scenarios**:

1. **Given** AI needs to test a command, **When** AI executes `pnpm mgtd:test task create -t "Test" --no-editor`, **Then** the command uses test database automatically without environment variables
2. **Given** production DB contains user data, **When** AI runs `pnpm test` or `pnpm mgtd:test`, **Then** all production data remains unchanged after tests complete
3. **Given** developer wants to verify a feature manually, **When** developer uses test command wrapper, **Then** all operations execute against test environment with no risk to production

---

### User Story 2 - Safe Test Environment by Default (Priority: P2)

As an AI assistant, I need test commands to use an isolated test environment by default, so that I don't need to remember environment variables for every test execution.

**Why this priority**: Making the safe path the default path reduces human/AI error. This is P2 because P1 already blocks dangerous operations, but this makes safe operations easier.

**Independent Test**: Can be tested by running `pnpm test` and verifying it automatically uses test-data/test.db without requiring manual environment variable setup.

**Acceptance Scenarios**:

1. **Given** AI wants to verify a feature, **When** AI runs `pnpm test`, **Then** all tests execute against test database without touching production
2. **Given** AI needs to manually test a command, **When** AI uses a dedicated test command wrapper (e.g., `pnpm mgtd:test`), **Then** the command automatically uses test environment
3. **Given** test environment doesn't exist, **When** test command is executed, **Then** system automatically creates isolated test environment

---

### User Story 3 - Production Commands Work as Expected (Priority: P3)

As a human user in daily workflow, I need regular `mgtd` commands to work with production database by default, so that my normal usage is not interrupted by safety mechanisms designed for AI/testing.

**Why this priority**: This is P3 because it maintains backward compatibility. P1 and P2 already protect against AI/test accidents by providing separate command paths.

**Independent Test**: Can be tested by running `mgtd task create -t "Real Task" --no-editor` without any environment variables and verifying it operates on production DB as it currently does.

**Acceptance Scenarios**:

1. **Given** user runs `mgtd` command in normal workflow, **When** no environment variables are set, **Then** the command operates on production DB (current default behavior maintained)
2. **Given** user wants to use test environment explicitly, **When** user sets `DB_PATH=./test-data/test.db mgtd task create`, **Then** the command uses test database
3. **Given** existing user workflows, **When** this feature is deployed, **Then** no changes to user's daily commands are required

---

### Edge Cases

- What happens when test database directory doesn't exist (first test run)?
- How does system handle when user manually sets DB_PATH with test command wrapper?
- What happens when API server is running on production DB (port 3000) while tests execute on test DB (port 3001)?
- How does test command wrapper behave when test-data/test.db is corrupted or invalid?
- What happens when user runs `mgtd` command while inside packages/cli/test/ directory?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain current default behavior where `mgtd` commands use production DB (`~/.local/share/mgtd/issues.db`) when no environment variables are set
- **FR-002**: System MUST provide test command wrapper `pnpm mgtd:test` that automatically sets test environment variables
- **FR-003**: Test command wrapper MUST use test database at `./test-data/test.db` by default
- **FR-004**: Test execution command `pnpm test` MUST automatically use isolated test environment without manual environment variable configuration
- **FR-005**: System MUST preserve all existing data in production DB during implementation and deployment of this feature
- **FR-006**: Integration tests MUST continue to use temporary directories (existing behavior) without regression
- **FR-007**: API server startup MUST respect environment-based DB selection (port 3000 = production DB, port 3001 = test DB)
- **FR-008**: Test command wrapper MUST create test database directory and file if they don't exist
- **FR-009**: CLAUDE.md documentation MUST be updated to instruct AI to use `pnpm mgtd:test` instead of direct `mgtd` commands
- **FR-010**: Test command wrapper MUST pass all arguments and flags through to underlying `mgtd` command transparently

### Key Entities

- **Production Database**: The database file at `~/.local/share/mgtd/issues.db` containing user's real tasks, memos, and projects
- **Test Database**: Isolated database file at `./test-data/test.db` used for development and testing
- **Test Command Wrapper**: Script or alias (e.g., `pnpm mgtd:test`) that automatically configures test environment before executing mgtd commands
- **Environment Configuration**: Set of environment variables (`DB_PATH`, `MGTD_CONFIG_PATH`) controlling database selection

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing tasks, memos, and projects in production DB remain intact and unchanged after implementing this feature
- **SC-002**: 100% of test executions (via `pnpm test` or `pnpm mgtd:test`) use isolated test environment without manual intervention
- **SC-003**: Zero accidental production DB modifications occur during AI-driven test executions
- **SC-004**: Test command wrapper (`pnpm mgtd:test`) successfully executes all mgtd subcommands without requiring manual environment variable setup
- **SC-005**: Regular `mgtd` commands continue to work with production DB by default, maintaining backward compatibility for existing users
- **SC-006**: System startup time for test environment remains under 2 seconds
- **SC-007**: All integration tests pass without modification to existing test code

## Assumptions

- Production database is located at `~/.local/share/mgtd/issues.db` on the system
- Test database should be located at `./test-data/test.db` relative to project root
- Current integration tests already use proper isolation via temporary directories
- API server on port 3000 indicates production, port 3001 indicates test environment
- AI will follow CLAUDE.md instructions to use test command wrapper instead of direct mgtd commands
- Test command wrapper adds negligible performance overhead (< 50ms)
- Users can continue using `mgtd` commands directly for production work without changes

## Dependencies

- Existing config loading mechanism in `packages/config/src/index.ts`
- CLAUDE.md documentation must be updated to reflect new safety mechanisms
- Integration test framework already in place

## Out of Scope

- Automatic backup/restore of production database (separate feature)
- Migration rollback mechanisms
- Multi-user access control or permissions
- Cloud/remote database protection
- Real-time monitoring dashboard for DB access
- Automated data recovery tools
