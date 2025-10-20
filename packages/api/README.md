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

### Development Mode

```bash
# Start server with hot reload
pnpm dev
```

### Production Mode

```bash
# Build and start
pnpm build
pnpm start
```

### Custom Configuration

```bash
# Specify port and database path
node dist/index.js --port 4000 --db ~/data/issues.db

# Environment variables
PORT=4000 \
DB_PATH=~/data/issues.db \
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080 \
LOG_LEVEL=debug \
node dist/index.js
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
```

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
