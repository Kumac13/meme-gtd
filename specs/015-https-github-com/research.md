# Research: Project Management Implementation Patterns

**Date**: 2025-10-24
**Feature**: Project Management CLI Commands and API
**Purpose**: Document existing patterns to ensure consistent implementation

## Executive Summary

This research analyzes the existing codebase patterns for implementing project management features in both CLI and API layers. The meme-gtd project follows a layered monorepo architecture with established conventions for commands, routes, services, and repositories. All findings are based on existing implementations of tasks, memos, and links features.

---

## 1. CLI Command Patterns

### 1.1 Command Structure (oclif Framework)

**Directory Organization**:
```
packages/cli/src/commands/
└── project/
    ├── index.ts      # Root command (mgtd project) - shows help
    ├── create.ts     # mgtd project create
    ├── list.ts       # mgtd project list (can also be in index.ts)
    ├── view.ts       # mgtd project view <id>
    ├── add.ts        # mgtd project add <project-id> <issue-id>
    ├── remove.ts     # mgtd project remove <project-id> <issue-id>
    ├── move.ts       # mgtd project move <project-id> <issue-id>
    └── delete.ts     # mgtd project delete <project-id>
```

**Command Class Template**:
```typescript
import { Command, Flags, Args } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ProjectService } from 'meme-gtd-core';

export default class ProjectCreate extends Command {
  static summary = 'Create a new project';
  static description = 'Detailed description...';
  static usage = '<%= command.id %> <name> [options]';
  static examples = [
    '$ mgtd project create "Sprint 1"',
    '$ mgtd project create "Q4 Goals" --description "Year-end objectives" --view board'
  ];

  static args = {
    name: Args.string({
      description: 'Project name',
      required: true
    })
  };

  static flags = {
    description: Flags.string({
      char: 'd',
      summary: 'Project description',
      required: false
    }),
    view: Flags.string({
      char: 'v',
      summary: 'View type (board or table)',
      options: ['board', 'table'],
      default: 'board'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProjectCreate);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new ProjectService({ config });

    try {
      const project = service.create({
        name: args.name,
        description: flags.description,
        view: flags.view as 'board' | 'table'
      });

      if (flags.json) {
        this.log(JSON.stringify(project, null, 2));
        return;
      }

      this.log(`Project created: #${project.id} - ${project.name}`);
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
```

### 1.2 Confirmation Prompt Pattern

**Decision**: Use interactive prompt with three modes:
1. **--yes flag provided**: Skip prompt, execute immediately
2. **JSON mode (--json)**: Require --yes flag (no interactive prompt in JSON mode)
3. **TTY available**: Show interactive prompt
4. **No TTY**: Error with message to use --yes flag

**Implementation** (from link/remove.ts):
```typescript
static flags = {
  yes: Flags.boolean({
    char: 'y',
    summary: 'Skip confirmation prompt',
    default: false
  }),
  json: Flags.boolean({
    char: 'j',
    summary: 'Return JSON output',
    default: false
  })
};

async run(): Promise<void> {
  const { args, flags } = await this.parse(ProjectDelete);

  // Mode 1: --yes flag (non-interactive)
  if (flags.yes) {
    service.delete(projectId);
    if (flags.json) {
      this.log(JSON.stringify({ deleted: true, projectId }));
    } else {
      this.log(`Project #${projectId} deleted`);
    }
    return;
  }

  // Mode 2: JSON mode requires --yes
  if (flags.json) {
    this.log(JSON.stringify({
      deleted: false,
      projectId,
      reason: 'JSON mode requires --yes flag for confirmation'
    }));
    return;
  }

  // Mode 3: Check TTY
  if (!process.stdin.isTTY) {
    this.error('Cannot prompt for confirmation. Please use --yes flag.', { exit: 1 });
  }

  // Mode 4: Interactive prompt
  const confirmed = await this.promptConfirmation(projectId);
  if (confirmed) {
    service.delete(projectId);
    this.log(`Project #${projectId} deleted`);
  } else {
    this.log('Cancelled');
  }
}
```

### 1.3 JSON Output Convention

**Rule**: Use `JSON.stringify(data, null, 2)` for pretty-printed output.

**Patterns**:
- Single resource: `{ project: {...} }`
- Collection: `{ projects: [{...}, {...}] }`
- Error: `{ error: "...", code: "...", details: {...} }`
- Deletion: `{ deleted: true, id: 5 }`

---

## 2. API Patterns

### 2.1 Route Registration (Fastify + Zod)

**File Structure**:
```
packages/api/src/
├── routes/
│   └── projects.ts          # Route registration with schemas
├── handlers/
│   └── projectHandlers.ts   # Request handlers (logic)
├── schemas/
│   └── projectSchemas.ts    # Zod validation schemas
```

**Route Registration Pattern**:
```typescript
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createProjectHandler, listProjectsHandler, getProjectHandler } from '../handlers/projectHandlers.js';
import { CreateProjectRequestSchema, ProjectSchema, ProjectIdParamsSchema } from '../schemas/projectSchemas.js';
import { ErrorResponseSchema } from '../schemas/errorSchemas.js';

export async function projectRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/projects
  server.post(
    '/api/projects',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Create project',
        description: 'Create a new project',
        operationId: 'createProject',
        body: CreateProjectRequestSchema,
        response: {
          201: ProjectSchema,
          400: ErrorResponseSchema,
          409: ErrorResponseSchema,  // Duplicate name
        },
      },
    },
    createProjectHandler
  );

  // GET /api/projects
  server.get(
    '/api/projects',
    {
      schema: {
        tags: ['Projects'],
        summary: 'List projects',
        operationId: 'listProjects',
        response: {
          200: z.array(ProjectSchema),
        },
      },
    },
    listProjectsHandler
  );

  // GET /api/projects/:id
  server.get(
    '/api/projects/:id',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Get project',
        operationId: 'getProject',
        params: ProjectIdParamsSchema,
        response: {
          200: ProjectDetailSchema,  // Includes items
          404: ErrorResponseSchema,
        },
      },
    },
    getProjectHandler
  );
}
```

### 2.2 Handler Pattern

**Characteristics**:
- Service instantiation: `new ProjectService({ db: request.server.db })`
- Error translation: Service exceptions → AppError subclasses
- HTTP status codes: 201 (created), 200 (OK), 204 (no content), 400, 404, 409
- Type safety: TypeScript generics for Request/Reply

**Example**:
```typescript
export async function createProjectHandler(
  request: FastifyRequest<{ Body: CreateProjectRequest }>,
  reply: FastifyReply
) {
  const { name, description, view } = request.body;
  const projectService = new ProjectService({ db: request.server.db });

  try {
    const project = projectService.create({ name, description, view });
    return reply.status(201).send(project);
  } catch (error) {
    if (error instanceof Error) {
      // Duplicate project name
      if (error.message.includes('UNIQUE constraint')) {
        throw new ConflictError(`Project with name "${name}" already exists`);
      }
    }
    throw error;
  }
}
```

### 2.3 Zod Schema Pattern

**Naming Convention**: `{Entity}Schema`, `{Entity}RequestSchema`, `{Entity}ParamsSchema`

**Example**:
```typescript
import { z } from 'zod';

export const ViewTypeSchema = z.enum(['board', 'table']);
export type ViewType = z.infer<typeof ViewTypeSchema>;

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1).max(255).describe('Project name (must be unique)'),
  description: z.string().optional().describe('Project description'),
  view: ViewTypeSchema.optional().default('board').describe('View type (board or table)'),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const ProjectSchema = z.object({
  id: z.number().int().positive().describe('Unique project ID'),
  name: z.string().describe('Project name'),
  description: z.string().nullable().describe('Project description'),
  viewMeta: z.object({
    viewType: ViewTypeSchema,
    columns: z.array(z.string()).optional(),
  }).describe('View configuration'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectDetailSchema = ProjectSchema.extend({
  items: z.array(ProjectItemSchema).describe('Project items'),
});
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
```

---

## 3. Service Layer Patterns

### 3.1 Service Class Structure

**Pattern**: Class-based with dependency injection (config or db)

```typescript
import type { MgtdConfig } from 'meme-gtd-config';
import type Database from 'better-sqlite3';
import { ensureDatabase } from 'meme-gtd-db';
import * as projectRepo from 'meme-gtd-db';

export interface ProjectServiceOptions {
  config?: MgtdConfig;
  db?: Database.Database;
}

export class ProjectService {
  private readonly db: Database.Database;

  constructor(private readonly options: ProjectServiceOptions) {
    if (options.db) {
      this.db = options.db;
    } else if (options.config) {
      this.db = ensureDatabase(options.config);
    } else {
      throw new Error('ProjectService requires either db or config option');
    }
  }

  create(input: { name: string; description?: string; view?: 'board' | 'table' }): Project {
    // Validation layer
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    // Build view_meta based on view type
    const viewMeta = this.buildViewMeta(input.view ?? 'board');

    // Delegate to repository
    return projectRepo.createProject(this.db, {
      name: input.name.trim(),
      description: input.description?.trim(),
      viewMeta,
    });
  }

  private buildViewMeta(viewType: 'board' | 'table'): string {
    if (viewType === 'board') {
      return JSON.stringify({
        viewType: 'board',
        columns: ['To Do', 'In Progress', 'Done'],
      });
    }
    return JSON.stringify({ viewType: 'table' });
  }

  list(): Project[] {
    return projectRepo.listProjects(this.db);
  }

  getById(projectId: number): ProjectDetail {
    const project = projectRepo.getProjectById(this.db, projectId);
    const items = projectRepo.listProjectItems(this.db, projectId);
    return { ...project, items };
  }

  delete(projectId: number): void {
    projectRepo.deleteProject(this.db, projectId);
  }
}
```

### 3.2 Validation Strategy

**Layers**:
1. **Service layer**: Business logic validation (required fields, format)
2. **Repository layer**: Data integrity validation (existence checks)
3. **Database**: Constraint enforcement (UNIQUE, FOREIGN KEY)

**Example** (from linkService.ts):
```typescript
create(sourceId: number, targetId: number, type: LinkType): Link {
  // V1: Self-reference
  if (sourceId === targetId) {
    throw new Error('Cannot link issue to itself');
  }

  // V2-V3: Existence checks
  if (!issueExists(this.db, sourceId)) {
    throw new Error(`Issue #${sourceId} not found`);
  }
  if (!issueExists(this.db, targetId)) {
    throw new Error(`Issue #${targetId} not found`);
  }

  // V4: Duplicate check
  const existing = findLink(this.db, { sourceId, targetId, type });
  if (existing) {
    throw new Error('Link already exists');
  }

  // V5: Business rule (inverse parent-child)
  const inverse = findInverseParentChildLink(this.db, sourceId, targetId, type);
  if (inverse) {
    throw new Error('Inverse parent-child link exists');
  }

  // V6: Business rule (circular hierarchy)
  if ((type === 'parent' || type === 'child') && hasAncestor(this.db, ...)) {
    throw new Error('Circular relationship detected');
  }

  // All validations passed
  return dbCreateLink(this.db, { sourceId, targetId, type });
}
```

---

## 4. Repository Layer Patterns

### 4.1 Functional Repository Pattern

**Decision**: Use functional exports instead of classes for simplicity.

**Example**:
```typescript
import Database from 'better-sqlite3';
import { nowIso, type Project } from 'meme-gtd-shared';

export interface CreateProjectInput {
  name: string;
  description?: string;
  viewMeta: string;  // JSON string
}

const projectRowToProject = (row: any): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  viewMeta: row.view_meta ? JSON.parse(row.view_meta) : { viewType: 'board' },
  createdAt: row.created_at,
});

export const createProject = (db: Database.Database, input: CreateProjectInput): Project => {
  const now = nowIso();
  const stmt = db.prepare(`
    INSERT INTO projects (name, description, view_meta, created_at)
    VALUES (@name, @description, @viewMeta, @createdAt)
  `);

  const result = stmt.run({
    name: input.name,
    description: input.description ?? null,
    viewMeta: input.viewMeta,
    createdAt: now,
  });

  return {
    id: result.lastInsertRowid as number,
    name: input.name,
    description: input.description ?? null,
    viewMeta: JSON.parse(input.viewMeta),
    createdAt: now,
  };
};

export const listProjects = (db: Database.Database): Project[] => {
  const stmt = db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
  const rows = stmt.all() as any[];
  return rows.map(projectRowToProject);
};

export const getProjectById = (db: Database.Database, projectId: number): Project => {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = @projectId');
  const row = stmt.get({ projectId }) as any | undefined;

  if (!row) {
    throw new Error(`Project #${projectId} not found`);
  }

  return projectRowToProject(row);
};

export const deleteProject = (db: Database.Database, projectId: number): void => {
  // Verify existence first
  getProjectById(db, projectId);

  const stmt = db.prepare('DELETE FROM projects WHERE id = @projectId');
  stmt.run({ projectId });
  // CASCADE will delete project_items automatically
};
```

### 4.2 SQL Best Practices

**Patterns**:
- Named parameters: `@paramName` (better-sqlite3 syntax)
- Prepared statements: Reusable queries with `.prepare()`
- Row mapping: `rowToObject()` functions for type conversion
- Existence verification: Check before delete/update
- Recursive CTE: For hierarchical queries (see linkRepository.ts `hasAncestor()`)

---

## 5. Testing Patterns

### 5.1 CLI Integration Tests

**Pattern**: Per-test isolated environment with temp database

```javascript
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, describe } from 'node:test';

const cliDist = path.resolve(process.cwd(), 'dist', 'index.js');

const runCli = (argv, options = {}) => {
  const result = spawnSync(process.execPath, [cliDist, ...argv], {
    encoding: 'utf8',
    env: options.env ?? process.env
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status
  };
};

describe('project create command', () => {
  let tmp, configPath, dbPath, env;

  test('setup test environment', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-project-'));
    configPath = path.join(tmp, 'context.json');
    dbPath = path.join(tmp, 'issues.db');
    env = {
      ...process.env,
      MGTD_CONFIG_PATH: configPath
    };

    const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
    assert.equal(init.status, 0, init.stderr);
  });

  test('creates project with name only', () => {
    const result = runCli(['project', 'create', 'Sprint 1', '-j'], { env });
    assert.equal(result.status, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.ok(output.project);
    assert.equal(output.project.name, 'Sprint 1');
    assert.ok(output.project.id > 0);
  });

  test('cleanup test environment', () => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
```

**Key Characteristics**:
- `mkdtempSync()` for isolated test DB
- Environment variable injection (`MGTD_CONFIG_PATH`)
- JSON parsing for output validation
- Cleanup in final test

---

## 6. Project-Specific Technical Decisions

### 6.1 View Metadata Structure

**Decision**: Store view configuration in `view_meta` JSON field at project level, store item-specific metadata in `project_items.view_meta`.

**Board View**:
```json
{
  "viewType": "board",
  "columns": ["To Do", "In Progress", "Done"]
}
```

**Table View**:
```json
{
  "viewType": "table"
}
```

**Rationale**:
- Default columns provide structure without being prescriptive
- Users can add items to any column name via `--column` flag
- Stored columns are informational, not restrictive
- Future enhancements can add column colors, order, etc.

### 6.2 Position Field Strategy

**Decision**: Use REAL type (floating point) for fractional positioning.

**Pattern**:
- New items default to `MAX(position) + 1.0`
- Insert between items: Use fractional values (e.g., 1.5 between 1.0 and 2.0)
- Reorder items: Update position without renumbering all items
- No automatic rebalancing (positions can grow sparse over time)

**Example**:
```sql
-- Get next position
SELECT COALESCE(MAX(position), 0) + 1.0 FROM project_items WHERE project_id = ?

-- Insert between positions 1.0 and 2.0
INSERT INTO project_items (..., position) VALUES (..., 1.5)

-- Move to specific position
UPDATE project_items SET position = ? WHERE id = ?
```

### 6.3 Column Metadata Storage

**Decision**: Store column information in `project_items.view_meta` as JSON.

**Structure**:
```json
{
  "column": "In Progress"
}
```

**Operations**:
- `mgtd project add <pid> <iid> --column "Done"` → Set view_meta on creation
- `mgtd project move <pid> <iid> --column "Done"` → Update view_meta

**Rationale**:
- Flexible: No predefined column names enforced
- Extensible: Can add other item-specific metadata later
- Simple: JSON field avoids additional tables

### 6.4 CLI and API JSON Format Consistency

**Decision**: CLI --json output must match API response structure.

**Example**:
```json
// CLI: mgtd project view 5 --json
// API: GET /api/projects/5
{
  "id": 5,
  "name": "Sprint 1",
  "description": "Q4 sprint",
  "viewMeta": {
    "viewType": "board",
    "columns": ["To Do", "In Progress", "Done"]
  },
  "createdAt": "2025-10-24T10:00:00Z",
  "items": [
    {
      "id": 10,
      "projectId": 5,
      "issueId": 12,
      "position": 1.0,
      "viewMeta": { "column": "To Do" },
      "issue": {
        "id": 12,
        "type": "task",
        "title": "Implement feature X"
      },
      "createdAt": "2025-10-24T10:05:00Z",
      "updatedAt": "2025-10-24T10:05:00Z"
    }
  ]
}
```

**Benefit**: Users can switch between CLI and API seamlessly with same data structure.

---

## 7. Implementation Checklist

Based on research findings, the following must be implemented:

### CLI Layer
- [x] 7 command files in `packages/cli/src/commands/project/`
- [x] Interactive confirmation prompts (delete, remove)
- [x] --json flag support for all commands
- [x] Integration tests in `packages/cli/test/commands/project/`

### API Layer
- [x] Route registration in `packages/api/src/routes/projects.ts`
- [x] Handler functions in `packages/api/src/handlers/projectHandlers.ts`
- [x] Zod schemas in `packages/api/src/schemas/projectSchemas.ts`
- [x] Error translation (service errors → AppError)

### Service Layer
- [x] ProjectService class in `packages/core/src/projectService.ts`
- [x] Validation logic (name required, view type)
- [x] view_meta JSON generation

### Repository Layer
- [x] projectRepository.ts (create, list, get, delete)
- [x] projectItemRepository.ts (add, remove, move, list)
- [x] Row mapping functions
- [x] SQL prepared statements

### Types
- [x] Project, ProjectItem, ViewType types in `packages/shared/src/types/project.ts`
- [x] Export from index.ts

---

## 8. Conclusion

This research documents all patterns needed for implementing project management features. Key findings:

1. **CLI**: oclif Command classes with Flags, Args, confirmation prompts, JSON output
2. **API**: Fastify + Zod schema-first approach with typed handlers
3. **Service**: Class-based with dependency injection, validation layer
4. **Repository**: Functional pattern with better-sqlite3, prepared statements
5. **Testing**: Isolated temp databases, subprocess execution, JSON parsing

All patterns are consistent with existing tasks, memos, and links implementations. No new architectural concepts are introduced - this is a straightforward extension of established patterns.
