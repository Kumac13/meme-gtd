import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestServer } from "../helpers/testServer.js";
import type { FastifyInstance } from "fastify";

describe("Template API", () => {
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

  it("POST /api/templates creates a template with target and labels", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/templates",
      payload: {
        title: "Deploy checklist",
        bodyMd: "## steps\n- [ ] tag",
        templateTarget: "task",
        labels: ["ops"]
      }
    });
    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.id);
    assert.strictEqual(body.type, "template");
    assert.strictEqual(body.templateTarget, "task");
    assert.deepStrictEqual(body.labels, ["ops"]);
  });

  it("GET /api/templates?target= filters by produced type", async () => {
    await app.inject({
      method: "POST",
      url: "/api/templates",
      payload: { title: "Book note", bodyMd: "- author:", templateTarget: "article" }
    });

    const taskList = JSON.parse((await app.inject({ method: "GET", url: "/api/templates?target=task" })).payload);
    assert.ok(taskList.data.every((t: { templateTarget: string }) => t.templateTarget === "task"));

    const articleList = JSON.parse((await app.inject({ method: "GET", url: "/api/templates?target=article" })).payload);
    assert.strictEqual(articleList.data.length, 1);
    assert.strictEqual(articleList.data[0].title, "Book note");
  });

  it("GET /api/templates/:id returns prefill data (labels), PATCH updates, DELETE soft-deletes", async () => {
    const created = JSON.parse(
      (await app.inject({
        method: "POST",
        url: "/api/templates",
        payload: { title: "T", bodyMd: "body", templateTarget: "task", labels: ["a"] }
      })).payload
    );

    const got = JSON.parse((await app.inject({ method: "GET", url: `/api/templates/${created.id}` })).payload);
    assert.strictEqual(got.bodyMd, "body");
    assert.deepStrictEqual(got.labels, ["a"]);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/templates/${created.id}`,
      payload: { title: "T2", labels: ["a", "b"] }
    });
    assert.strictEqual(patched.statusCode, 200);
    const patchedBody = JSON.parse(patched.payload);
    assert.strictEqual(patchedBody.title, "T2");
    assert.deepStrictEqual([...patchedBody.labels].sort(), ["a", "b"]);

    const del = await app.inject({ method: "DELETE", url: `/api/templates/${created.id}` });
    assert.strictEqual(del.statusCode, 204);
    const after = await app.inject({ method: "GET", url: `/api/templates/${created.id}` });
    assert.strictEqual(after.statusCode, 404);
  });

  it("rejects an invalid target and an empty title", async () => {
    const badTarget = await app.inject({
      method: "POST",
      url: "/api/templates",
      payload: { title: "x", bodyMd: "b", templateTarget: "memo" }
    });
    assert.strictEqual(badTarget.statusCode, 400);

    const emptyTitle = await app.inject({
      method: "POST",
      url: "/api/templates",
      payload: { title: "", bodyMd: "b", templateTarget: "task" }
    });
    assert.strictEqual(emptyTitle.statusCode, 400);
  });
});
