import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestServer } from "../helpers/testServer.js";
import type { FastifyInstance } from "fastify";
import { createArticle } from "meme-gtd-db";

describe("Article List API", () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  before(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
    await app.ready();

    // Seed data
    createArticle(app.db, {
      title: "Article 1",
      bodyMd: "Body 1",
      originalUrl: "http://example.com/1"
    });
    createArticle(app.db, {
      title: "Article 2",
      bodyMd: "Body 2",
      originalUrl: "http://example.com/2"
    });
  });

  after(async () => {
    await cleanup();
  });

  it("GET /api/articles should return paginated list of articles", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/articles"
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.ok(result.data);
    assert.strictEqual(Array.isArray(result.data), true);
    assert.strictEqual(result.data.length, 2);
    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.limit, 100);
    assert.strictEqual(result.offset, 0);
    assert.strictEqual(result.data[0].title, "Article 2"); // Descending order
  });

  it("GET /api/articles?search= should filter by title", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/articles?search=Article 1"
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.ok(result.data);
    assert.strictEqual(Array.isArray(result.data), true);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.data[0].title, "Article 1");
  });

  it("GET /api/articles?search= should filter by body", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/articles?search=Body 2"
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.ok(result.data);
    assert.strictEqual(Array.isArray(result.data), true);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.data[0].title, "Article 2");
  });

  it("GET /api/articles?search= should return empty for no match", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/articles?search=nonexistent"
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.ok(result.data);
    assert.strictEqual(Array.isArray(result.data), true);
    assert.strictEqual(result.data.length, 0);
    assert.strictEqual(result.total, 0);
  });

  it("GET /api/articles should support pagination parameters", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/articles?limit=1&offset=1"
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.limit, 1);
    assert.strictEqual(result.offset, 1);
    assert.strictEqual(result.data[0].title, "Article 1"); // Second article (offset=1)
  });
});
