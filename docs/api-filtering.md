# API Filtering Documentation

This document describes how to filter tasks and memos using the REST API.

## Base URL

```
http://localhost:3000/api
```

## Tasks Endpoint

### GET /api/tasks

List all tasks with optional filters.

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string | Filter by task status | `open`, `next`, `waiting`, `scheduled`, `done`, `canceled` |
| `bookmarked` | string | Filter by bookmark status | `true`, `false` |
| `label` | string | Filter by label name(s). Comma-separated for OR logic | `bug`, `bug,enhancement` |

#### Filter by Single Label

```bash
curl http://localhost:3000/api/tasks?label=bug
```

**Response:**
```json
[
  {
    "id": 1,
    "type": "task",
    "title": "Fix login bug",
    "bodyMd": "Description...",
    "status": "open",
    "labels": ["bug"],
    ...
  }
]
```

#### Filter by Multiple Labels (OR Logic)

Use comma-separated values to filter by multiple labels. Tasks matching ANY of the specified labels will be returned.

```bash
curl http://localhost:3000/api/tasks?label=bug,enhancement
```

#### Filter by Status

```bash
curl http://localhost:3000/api/tasks?status=open
curl http://localhost:3000/api/tasks?status=next
curl http://localhost:3000/api/tasks?status=done
```

#### Combined Filters (AND Logic)

Combine multiple filter parameters. Tasks must match ALL specified criteria.

```bash
# Open bugs only
curl http://localhost:3000/api/tasks?label=bug&status=open

# Bookmarked bugs and enhancements
curl http://localhost:3000/api/tasks?label=bug,enhancement&bookmarked=true

# Next status with urgent label
curl http://localhost:3000/api/tasks?status=next&label=urgent
```

#### Error Handling

**Invalid Status:**
```bash
curl http://localhost:3000/api/tasks?status=invalid
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid status value",
  "details": "status must be one of: open, next, waiting, scheduled, done, canceled"
}
```

## Memos Endpoint

### GET /api/memos

List all memos with optional filters.

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `bookmarked` | string | Filter by bookmark status | `true`, `false` |
| `label` | string | Filter by label name(s). Comma-separated for OR logic | `idea`, `idea,meeting-notes` |

**Note:** Memos do not have status. The `status` parameter is silently ignored if provided.

#### Filter by Single Label

```bash
curl http://localhost:3000/api/memos?label=idea
```

#### Filter by Multiple Labels (OR Logic)

```bash
curl http://localhost:3000/api/memos?label=idea,meeting-notes
```

#### Combined Filters

```bash
# Bookmarked ideas
curl http://localhost:3000/api/memos?label=idea&bookmarked=true

# Multiple labels with bookmark filter
curl http://localhost:3000/api/memos?label=inbox,todo&bookmarked=true
```

## Advanced Examples

### Using with jq (JSON processor)

```bash
# Extract only task titles
curl -s http://localhost:3000/api/tasks?label=bug | jq '.[].title'

# Count open bugs
curl -s http://localhost:3000/api/tasks?label=bug&status=open | jq 'length'

# Filter and format
curl -s http://localhost:3000/api/tasks?status=open | jq '.[] | {id, title, labels}'

# Extract specific fields
curl -s http://localhost:3000/api/memos?label=idea | jq '.[] | {id, bodyMd}'
```

### Integration Examples

#### Python

```python
import requests

# Get open bugs
response = requests.get('http://localhost:3000/api/tasks', params={
    'label': 'bug',
    'status': 'open'
})
tasks = response.json()

for task in tasks:
    print(f"{task['id']}: {task['title']}")
```

#### JavaScript (Node.js)

```javascript
const fetch = require('node-fetch');

async function getOpenBugs() {
    const params = new URLSearchParams({
        label: 'bug',
        status: 'open'
    });

    const response = await fetch(`http://localhost:3000/api/tasks?${params}`);
    const tasks = await response.json();

    tasks.forEach(task => {
        console.log(`${task.id}: ${task.title}`);
    });
}

getOpenBugs();
```

#### Shell Script

```bash
#!/bin/bash

# Get all urgent tasks
URGENT_TASKS=$(curl -s "http://localhost:3000/api/tasks?label=urgent")

# Count them
COUNT=$(echo "$URGENT_TASKS" | jq 'length')

echo "Found $COUNT urgent tasks"

# Display titles
echo "$URGENT_TASKS" | jq -r '.[] | "\(.id): \(.title)"'
```

## Response Format

All list endpoints return an array of objects. Each object contains:

**Task:**
```json
{
  "id": 1,
  "type": "task",
  "title": "Task title",
  "bodyMd": "Description in Markdown",
  "status": "open",
  "scheduledOn": "2025-11-05",
  "meta": {},
  "isBookmarked": false,
  "isDeleted": false,
  "createdAt": "2025-11-04T00:00:00.000Z",
  "updatedAt": "2025-11-04T00:00:00.000Z",
  "labels": ["bug", "urgent"],
  "commentCount": 2
}
```

**Memo:**
```json
{
  "id": 1,
  "type": "memo",
  "title": null,
  "bodyMd": "Memo content in Markdown",
  "status": null,
  "scheduledOn": null,
  "meta": {},
  "isBookmarked": false,
  "isDeleted": false,
  "createdAt": "2025-11-04T00:00:00.000Z",
  "updatedAt": "2025-11-04T00:00:00.000Z",
  "labels": ["idea", "inbox"],
  "commentCount": 0
}
```

## Notes

- **Case Sensitivity**: Label matching is case-insensitive
- **Whitespace**: Leading and trailing spaces in label values are automatically trimmed
- **Empty Results**: Returns an empty array `[]` when no items match the filter criteria
- **URL Encoding**: Special characters in label names must be URL-encoded (e.g., spaces as `%20`)
- **Performance**: All endpoints return results instantly for datasets up to 1000 items

## OpenAPI Documentation

For complete API documentation including all endpoints, visit:

```
http://localhost:3000/api-docs
```
