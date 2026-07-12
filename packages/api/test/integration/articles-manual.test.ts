import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestServer } from "../helpers/testServer.js";
import type { FastifyInstance } from "fastify";

describe("Article manual creation / origin / comments", () => {
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

  const createManual = async (title = "Reading note", bodyMd = "- author:\n- publisher:") => {
    const res = await app.inject({
      method: "POST",
      url: "/api/articles",
      payload: { title, bodyMd, labels: ["book"] }
    });
    assert.strictEqual(res.statusCode, 201);
    return JSON.parse(res.payload);
  };

  const createWeb = async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/articles",
      payload: {
        title: "Web article",
        bodyMd: "extracted body",
        originalUrl: "https://example.com/post",
        siteName: "Example"
      }
    });
    assert.strictEqual(res.statusCode, 201);
    return JSON.parse(res.payload);
  };

  it("creates a manual article (no originalUrl) with origin=manual", async () => {
    const article = await createManual();
    assert.strictEqual(article.origin, "manual");
    assert.strictEqual(article.meta.originalUrl, undefined);
    assert.deepStrictEqual(article.labels, ["book"]);
  });

  it("creates a web-saved article with origin=web", async () => {
    const article = await createWeb();
    assert.strictEqual(article.origin, "web");
    assert.strictEqual(article.meta.originalUrl, "https://example.com/post");
  });

  it("PATCH updates a manual article's title/body", async () => {
    const article = await createManual("Before", "old body");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/articles/${article.id}`,
      payload: { title: "After", bodyMd: "new body" }
    });
    assert.strictEqual(res.statusCode, 200);
    const updated = JSON.parse(res.payload);
    assert.strictEqual(updated.title, "After");
    assert.strictEqual(updated.bodyMd, "new body");
  });

  it("PATCH on a web-saved article is rejected (read-only)", async () => {
    const article = await createWeb();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/articles/${article.id}`,
      payload: { bodyMd: "tampered" }
    });
    assert.strictEqual(res.statusCode, 400);
  });

  it("bookmark/unbookmark works and the list filters by bookmarked", async () => {
    const article = await createManual("Bookmark me");
    const marked = await app.inject({ method: "POST", url: `/api/articles/${article.id}/bookmark` });
    assert.strictEqual(marked.statusCode, 200);
    assert.strictEqual(JSON.parse(marked.payload).isBookmarked, true);

    const filtered = JSON.parse(
      (await app.inject({ method: "GET", url: "/api/articles?bookmarked=true" })).payload
    );
    assert.ok(filtered.data.some((a: { id: number }) => a.id === article.id));

    const unmarked = await app.inject({ method: "POST", url: `/api/articles/${article.id}/unbookmark` });
    assert.strictEqual(JSON.parse(unmarked.payload).isBookmarked, false);
  });

  it("list filters by origin and label", async () => {
    const manualOnly = JSON.parse(
      (await app.inject({ method: "GET", url: "/api/articles?origin=manual" })).payload
    );
    assert.ok(manualOnly.data.every((a: { origin: string }) => a.origin === "manual"));

    const webOnly = JSON.parse(
      (await app.inject({ method: "GET", url: "/api/articles?origin=web" })).payload
    );
    assert.ok(webOnly.data.every((a: { origin: string }) => a.origin === "web"));
    assert.ok(webOnly.data.length > 0);

    const byLabel = JSON.parse(
      (await app.inject({ method: "GET", url: "/api/articles?label=book" })).payload
    );
    assert.ok(byLabel.data.length > 0);
    assert.ok(byLabel.data.every((a: { labels?: string[] }) => a.labels?.includes("book")));
  });

  it("article comments CRUD works", async () => {
    const article = await createWeb();

    const created = await app.inject({
      method: "POST",
      url: `/api/articles/${article.id}/comments`,
      payload: { bodyMd: "dense structure" }
    });
    assert.strictEqual(created.statusCode, 201);
    const comment = JSON.parse(created.payload);
    assert.strictEqual(comment.issueId, article.id);

    const listed = JSON.parse(
      (await app.inject({ method: "GET", url: `/api/articles/${article.id}/comments` })).payload
    );
    assert.strictEqual(listed.length, 1);

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/articles/${article.id}/comments/${comment.id}`,
      payload: { bodyMd: "peppery notes" }
    });
    assert.strictEqual(updated.statusCode, 200);
    assert.strictEqual(JSON.parse(updated.payload).bodyMd, "peppery notes");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/articles/${article.id}/comments/${comment.id}`
    });
    assert.strictEqual(deleted.statusCode, 204);

    const after = JSON.parse(
      (await app.inject({ method: "GET", url: `/api/articles/${article.id}/comments` })).payload
    );
    assert.strictEqual(after.length, 0);
  });
});
