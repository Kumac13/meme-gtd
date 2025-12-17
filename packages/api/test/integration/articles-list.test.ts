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

  it("GET /api/articles should return list of articles", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/articles"
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(Array.isArray(body), true);
    assert.strictEqual(body.length, 2);
    assert.strictEqual(body[0].title, "Article 2"); // Descending order
  });

  it("GET /api/articles?search= should filter by title", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/articles?search=Article 1"
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(Array.isArray(body), true);
    assert.strictEqual(body.length, 1);
    assert.strictEqual(body[0].title, "Article 1");
  });

  it("GET /api/articles?search= should filter by body", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/articles?search=Body 2"
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(Array.isArray(body), true);
    assert.strictEqual(body.length, 1);
    assert.strictEqual(body[0].title, "Article 2");
  });

  it("GET /api/articles?search= should return empty for no match", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/articles?search=nonexistent"
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(Array.isArray(body), true);
    assert.strictEqual(body.length, 0);
  });
});