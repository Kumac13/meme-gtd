import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestServer } from "../helpers/testServer.js";
import type { FastifyInstance } from "fastify";
import { createArticle } from "meme-gtd-db";

describe("Article Get API", () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;
  let articleId: number;

  before(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
    await app.ready();

    const article = createArticle(app.db, {
      title: "Test Article",
      bodyMd: "Body",
      originalUrl: "http://example.com"
    });
    articleId = article.id;
  });

  after(async () => {
    await cleanup();
  });

  it("GET /api/articles/:id should return article details", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/articles/${articleId}`
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.id, articleId);
    assert.strictEqual(body.title, "Test Article");
  });

  it("GET /api/articles/:id should return 404 for non-existent article", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/articles/9999"
    });

    assert.strictEqual(res.statusCode, 404);
  });
});