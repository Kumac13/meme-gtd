import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

describe('Swagger UI and OpenAPI Documentation', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;

    // Ensure app is ready before accessing swagger spec
    await app.ready();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should serve Swagger UI at /api-docs', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api-docs',
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8');

    // Verify it's actual Swagger UI HTML
    const html = response.body;
    assert.ok(html.includes('swagger-ui'), 'Should contain swagger-ui reference');
    assert.ok(html.includes('Swagger UI') || html.includes('swagger'), 'Should be Swagger UI page');
  });

  it('should generate OpenAPI specification', async () => {
    // Access OpenAPI spec via app.swagger() method
    const spec = app.swagger();

    // Verify OpenAPI 3.0.3 structure
    assert.ok(spec.openapi, 'Should have openapi version');
    assert.ok(spec.openapi.startsWith('3.0'), 'Should be OpenAPI 3.0.x');

    // Verify info section
    assert.ok(spec.info, 'Should have info section');
    assert.strictEqual(spec.info.title, 'meme-gtd API');
    assert.strictEqual(spec.info.version, '0.9.0');
    assert.ok(spec.info.description);

    // Verify paths section
    assert.ok(spec.paths, 'Should have paths section');
    assert.ok(Object.keys(spec.paths).length > 0, 'Should have at least one path');

    // Verify components section (schemas)
    assert.ok(spec.components, 'Should have components section');
    assert.ok(spec.components.schemas, 'Should have schemas in components');
  });

  it('should include all major endpoints in OpenAPI spec', async () => {
    const spec = app.swagger();
    const paths = Object.keys(spec.paths);

    // Verify key endpoint categories are present
    const memoEndpoints = paths.filter(p => p.includes('/api/memos'));
    const taskEndpoints = paths.filter(p => p.includes('/api/tasks'));
    const labelEndpoints = paths.filter(p => p.includes('/api/labels'));
    const linkEndpoints = paths.filter(p => p.includes('/api/links'));
    const commentEndpoints = paths.filter(p => p.includes('/comments'));

    assert.ok(memoEndpoints.length > 0, 'Should have memo endpoints');
    assert.ok(taskEndpoints.length > 0, 'Should have task endpoints');
    assert.ok(labelEndpoints.length > 0, 'Should have label endpoints');
    assert.ok(linkEndpoints.length > 0, 'Should have link endpoints');
    assert.ok(commentEndpoints.length > 0, 'Should have comment endpoints');
  });

  it('should include nullable field support in schemas', async () => {
    const spec = app.swagger();

    const taskCreateResponse =
      spec.paths['/api/tasks']?.post?.responses?.['201']?.content?.['application/json']?.schema;
    assert.ok(taskCreateResponse, 'Should have 201 response schema for POST /api/tasks');

    const { properties } = taskCreateResponse;
    assert.ok(properties, 'Response schema should have properties');

    const scheduledOn = properties.scheduledOn;
    assert.ok(scheduledOn, 'Task response should include scheduledOn property');
    assert.strictEqual(scheduledOn.nullable, true, 'scheduledOn should be marked nullable');
  });

  it('should include 204 No Content responses for DELETE endpoints', async () => {
    const spec = app.swagger();

    // Find a DELETE endpoint
    const deleteMemoPath = spec.paths['/api/memos/{id}']?.delete;
    assert.ok(deleteMemoPath, 'Should have DELETE /api/memos/{id} endpoint');

    // Verify 204 response exists
    assert.ok(deleteMemoPath.responses, 'Should have responses');
    assert.ok(deleteMemoPath.responses['204'], 'Should have 204 No Content response');
  });

  it('should include tags in endpoints', async () => {
    const spec = app.swagger();

    // Verify tags are defined
    assert.ok(spec.tags, 'Should have tags section');
    assert.ok(spec.tags.length > 0, 'Should have at least one tag');

    // Verify endpoints use tags
    const memoCreatePath = spec.paths['/api/memos']?.post;
    assert.ok(memoCreatePath, 'Should have POST /api/memos endpoint');
    assert.ok(memoCreatePath.tags, 'Endpoint should have tags');
    assert.ok(memoCreatePath.tags.includes('Memos'), 'Should be tagged with Memos');
  });

  it('should include descriptions in endpoints', async () => {
    const spec = app.swagger();

    // Verify endpoints have descriptions
    const memoCreatePath = spec.paths['/api/memos']?.post;
    assert.ok(memoCreatePath, 'Should have POST /api/memos endpoint');
    assert.ok(memoCreatePath.description, 'Endpoint should have description');
  });
});
