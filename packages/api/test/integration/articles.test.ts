import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestServer } from "../helpers/testServer.js";
import type { FastifyInstance } from "fastify";

describe("Article API", () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  before(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
    await app.ready();
  });

  after(async () => {
    await cleanup();
  });

  it("POST /api/articles should create a new article", async () => {
    const payload = {
      title: "Test Article",
      bodyMd: "# Markdown Body",
      originalUrl: "https://example.com/article",
      siteName: "Example Site"
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/articles",
      payload
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.id);
    assert.strictEqual(body.title, payload.title);
    assert.strictEqual(body.meta.originalUrl, payload.originalUrl);
    assert.strictEqual(body.type, "article");
  });
});
