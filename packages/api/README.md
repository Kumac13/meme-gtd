# meme-gtd-api

HTTP REST API server for meme-gtd CLI operations.

## Overview

This package provides a Fastify-based HTTP API server that exposes all meme-gtd CLI operations (memos, tasks, labels, links, comments) via RESTful endpoints. It reuses the existing `meme-gtd-core` service layer to ensure consistency between CLI and API behavior.

## Features

- **Full CLI parity**: All CLI operations available via HTTP endpoints
- **OpenAPI 3.0.3**: Automatic API documentation with Swagger UI
- **Type-safe**: Zod schemas for request/response validation
- **Performance**: Fastify framework with JSON Schema serialization
- **Logging**: Structured JSON logs via Pino
- **Testing**: Integration tests with supertest

## Installation

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build
```

## Usage

### Quick Start

```bash
# IMPORTANT: Always run from repository root to use the same database as CLI
cd /path/to/meme-gtd

# Install dependencies (if not done)
pnpm install

# Start development server with hot reload
pnpm --filter meme-gtd-api dev

# Server starts at http://localhost:3000
# Access Swagger UI at http://localhost:3000/api-docs
```

**Note**: The API server must be started from the repository root directory to access the same database as the CLI. If your `dbPath` in `~/.config/mgtd/context.json` is a relative path (e.g., `.tmp/issues.db`), the server needs to run from the same directory as your CLI commands.

### Development Mode

```bash
# From repository root
pnpm --filter meme-gtd-api dev

# Or from packages/api directory
cd packages/api
pnpm dev
```

Server will start with hot reload. Any changes to source files will automatically restart the server.

### Production Mode

```bash
# From repository root
pnpm --filter meme-gtd-api build
pnpm --filter meme-gtd-api start

# Or from packages/api directory
cd packages/api
pnpm build
pnpm start
```

### Verify Server is Running

```bash
# Test API endpoint
curl http://localhost:3000/api/memos
# Expected response: []

# Create a memo
curl -X POST http://localhost:3000/api/memos \
  -H 'Content-Type: application/json' \
  -d '{"bodyMd":"Meeting notes from today"}'

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Review PR","bodyMd":"Check the API implementation"}'

# List all tasks
curl http://localhost:3000/api/tasks

# Filter tasks by status
curl 'http://localhost:3000/api/tasks?status=next'

# Get a specific task
curl http://localhost:3000/api/tasks/1

# Update a task
curl -X PATCH http://localhost:3000/api/tasks/1 \
  -H 'Content-Type: application/json' \
  -d '{"title":"Review PR - Updated"}'

# Close a task
curl -X POST http://localhost:3000/api/tasks/1/close

# Create a label
curl -X POST http://localhost:3000/api/labels \
  -H 'Content-Type: application/json' \
  -d '{"name":"bug","description":"Bug reports"}'

# Assign label to a task
curl -X POST http://localhost:3000/api/issues/1/labels \
  -H 'Content-Type: application/json' \
  -d '{"labelName":"bug"}'

# Create a link between issues
curl -X POST http://localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  -d '{"fromIssueId":1,"toIssueId":2,"linkType":"blocks"}'

# Add a comment to a task
curl -X POST http://localhost:3000/api/tasks/1/comments \
  -H 'Content-Type: application/json' \
  -d '{"bodyMd":"This looks good to me"}'

# Promote a memo to a task
curl -X POST http://localhost:3000/api/memos/1/promote \
  -H 'Content-Type: application/json' \
  -d '{"title":"Follow up on meeting","scheduledOn":"2025-10-21T10:00:00Z"}'

# Bookmark a task
curl -X POST http://localhost:3000/api/tasks/1/bookmark

# Delete a memo
curl -X DELETE http://localhost:3000/api/memos/1
```

### Custom Configuration

```bash
# Specify port and database path
pnpm --filter meme-gtd-api start -- --port 4000 --db ~/data/issues.db

# Or with environment variables
PORT=4000 \
DB_PATH=~/data/issues.db \
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080 \
LOG_LEVEL=debug \
pnpm --filter meme-gtd-api start
```

## API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI JSON**: http://localhost:3000/documentation/json

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `DB_PATH` | (from config) | SQLite database path |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `LOG_LEVEL` | `info` | Log level (trace, debug, info, warn, error, fatal) |
| `NODE_ENV` | `development` | Environment (development, production) |

## API Endpoints

### Memos

- `POST /api/memos` - Create memo
- `GET /api/memos` - List memos
- `GET /api/memos/:id` - Get memo detail
- `PATCH /api/memos/:id` - Update memo
- `DELETE /api/memos/:id` - Delete memo
- `POST /api/memos/:id/promote` - Promote memo to task
- `POST /api/memos/:id/bookmark` - Bookmark memo
- `POST /api/memos/:id/unbookmark` - Unbookmark memo

### Tasks

- `POST /api/tasks` - Create task
- `GET /api/tasks` - List tasks (with status filter)
- `GET /api/tasks/:id` - Get task detail
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/:id/close` - Close task (mark as done)
- `POST /api/tasks/:id/cancel` - Cancel task
- `POST /api/tasks/:id/reopen` - Reopen task
- `POST /api/tasks/:id/bookmark` - Bookmark task
- `POST /api/tasks/:id/unbookmark` - Unbookmark task

### Labels

- `GET /api/labels` - List all labels
- `POST /api/labels` - Create label
- `DELETE /api/labels/:name` - Delete label
- `POST /api/issues/:issueId/labels` - Assign label to issue

### Links

- `POST /api/links` - Create link between issues
- `DELETE /api/links/:id` - Delete link
- `GET /api/issues/:id/links` - List links for issue

### Comments

- `GET /api/memos/:memoId/comments` - List memo comments
- `POST /api/memos/:memoId/comments` - Create memo comment
- `GET /api/tasks/:taskId/comments` - List task comments
- `POST /api/tasks/:taskId/comments` - Create task comment
- `PATCH /api/{memos|tasks}/:issueId/comments/:commentId` - Update comment
- `DELETE /api/{memos|tasks}/:issueId/comments/:commentId` - Delete comment

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## OpenAPI Spec Generation

```bash
# Generate OpenAPI spec
pnpm openapi:generate

# Validate OpenAPI spec
pnpm openapi:validate

# Bundle OpenAPI spec (resolve all $refs)
pnpm openapi:bundle
```

The generated spec is output to `docs/api/openapi.yaml` and includes:
- Full endpoint documentation with tags and descriptions
- Request/response schemas with field descriptions
- Nullable field support (OpenAPI 3.0 compatible)
- Error response schemas

### Validation

OpenAPI validation is configured via `.redocly.yaml` and uses [@redocly/cli](https://redocly.com/docs/cli/):
- Validates spec structure and compliance with OpenAPI 3.0.3
- Checks for required fields (2xx responses, valid parameters)
- Warnings for missing summaries and operationIds (non-blocking)
- Security validation disabled (API relies on Tailscale network security)

Run `pnpm openapi:validate` before committing changes to catch specification errors early.

## SDK Generation

You can generate type-safe client SDKs from the OpenAPI specification using tools like:

### TypeScript/JavaScript (using openapi-typescript)

```bash
# Install openapi-typescript
npm install -D openapi-typescript

# Generate TypeScript types (using npm script)
pnpm sdk:generate-types

# Or run the script directly with custom output path
./scripts/generate-sdk-types.sh path/to/output.ts
```

### Python (using openapi-python-client)

```bash
# Install openapi-python-client
pip install openapi-python-client

# Generate Python client
openapi-python-client generate --path docs/api/openapi.yaml
```

### Other Languages

The OpenAPI specification can be used with various code generators:
- **Java**: openapi-generator (Spring, JAX-RS, etc.)
- **Go**: oapi-codegen
- **Rust**: openapi-generator
- **Ruby**: openapi-generator
- **PHP**: openapi-generator

See [OpenAPI Generator](https://openapi-generator.tech/) for more language options.

## Architecture

```
src/
├── server.ts           # Fastify app initialization
├── index.ts            # Entry point
├── config.ts           # Configuration management
├── routes/             # Route definitions
├── handlers/           # Request handlers
├── schemas/            # Zod validation schemas
├── middleware/         # CORS, error handling
└── errors/             # Custom error classes
```

## Security

This API server is designed to run behind TailScale network security. It does **not** include application-level authentication in v1. For production deployment:

1. Deploy server within TailScale network
2. Configure CORS allowed origins
3. Use reverse proxy (nginx, Caddy) for HTTPS termination
4. Enable structured logging for audit trails

## License

MIT
