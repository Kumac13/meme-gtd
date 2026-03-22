/* eslint-disable no-undef */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestServer } from "../helpers/testServer.js";
import type { FastifyInstance } from "fastify";
import {
  createMemo,
  createTask,
  upsertEmbedding,
  getEmbedding,
  getAllEmbeddings,
  deleteEmbedding,
  listUnembeddedIssues,
  listEmbeddingHashes,
} from "meme-gtd-db";
import {
  cosineSimilarity,
  bufferToFloat32Array,
  searchByVector,
  computeContentHash,
} from "meme-gtd-core";

/**
 * Create a deterministic fake embedding (not random, for reproducible tests)
 */
function fakeEmbedding(seed: number, dimensions: number = 4): Buffer {
  const arr = new Float32Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    arr[i] = Math.sin(seed * (i + 1));
  }
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

describe("Embedding Repository", () => {
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

  it("should upsert and retrieve an embedding", () => {
    const memo = createMemo(app.db, { bodyMd: "Test memo for embedding" });
    const buf = fakeEmbedding(1);
    const hash = computeContentHash(null, "Test memo for embedding");

    upsertEmbedding(app.db, memo.id, buf, "test-model", 4, hash);

    const result = getEmbedding(app.db, memo.id);
    assert.ok(result);
    assert.strictEqual(result.issueId, memo.id);
    assert.strictEqual(result.model, "test-model");
    assert.strictEqual(result.dimensions, 4);
    assert.strictEqual(result.contentHash, hash);
  });

  it("should upsert (update) an existing embedding", () => {
    const memo = createMemo(app.db, { bodyMd: "Memo to update" });
    const buf1 = fakeEmbedding(10);
    const buf2 = fakeEmbedding(20);
    const hash1 = computeContentHash(null, "Memo to update");
    const hash2 = computeContentHash(null, "Memo updated");

    upsertEmbedding(app.db, memo.id, buf1, "model-a", 4, hash1);
    upsertEmbedding(app.db, memo.id, buf2, "model-b", 4, hash2);

    const result = getEmbedding(app.db, memo.id);
    assert.ok(result);
    assert.strictEqual(result.model, "model-b");
    assert.strictEqual(result.contentHash, hash2);
  });

  it("should get all embeddings with issue type", () => {
    const memo = createMemo(app.db, { bodyMd: "Memo for getAllEmbeddings" });
    const task = createTask(app.db, { title: "Task for getAllEmbeddings", bodyMd: "" });
    upsertEmbedding(app.db, memo.id, fakeEmbedding(30), "test-model", 4, "hash30");
    upsertEmbedding(app.db, task.id, fakeEmbedding(31), "test-model", 4, "hash31");

    const all = getAllEmbeddings(app.db);
    const memoResult = all.find((e) => e.issueId === memo.id);
    const taskResult = all.find((e) => e.issueId === task.id);

    assert.ok(memoResult);
    assert.strictEqual(memoResult.issueType, "memo");
    assert.ok(taskResult);
    assert.strictEqual(taskResult.issueType, "task");
  });

  it("should delete an embedding", () => {
    const memo = createMemo(app.db, { bodyMd: "Memo to delete embedding" });
    upsertEmbedding(app.db, memo.id, fakeEmbedding(40), "test-model", 4, "hash40");

    deleteEmbedding(app.db, memo.id);

    const result = getEmbedding(app.db, memo.id);
    assert.strictEqual(result, null);
  });

  it("should list unembedded issues", () => {
    const memo = createMemo(app.db, { bodyMd: "Unembedded memo" });

    const unembedded = listUnembeddedIssues(app.db, "test-model");
    const found = unembedded.find((i) => i.id === memo.id);
    assert.ok(found, "Should find newly created memo in unembedded list");
  });

  it("should list unembedded issues when model differs", () => {
    const memo = createMemo(app.db, { bodyMd: "Model mismatch memo" });
    upsertEmbedding(app.db, memo.id, fakeEmbedding(50), "old-model", 4, "hash50");

    const unembedded = listUnembeddedIssues(app.db, "new-model");
    const found = unembedded.find((i) => i.id === memo.id);
    assert.ok(found, "Should find issue with different model in unembedded list");
  });

  it("should list embedding hashes", () => {
    const memo = createMemo(app.db, { bodyMd: "Hash test memo" });
    const hash = computeContentHash(null, "Hash test memo");
    upsertEmbedding(app.db, memo.id, fakeEmbedding(60), "test-model", 4, hash);

    const hashes = listEmbeddingHashes(app.db);
    const found = hashes.find((h) => h.issueId === memo.id);
    assert.ok(found);
    assert.strictEqual(found.contentHash, hash);
  });
});

describe("Vector Search", () => {
  it("cosineSimilarity should return 1.0 for identical vectors", () => {
    const a = new Float32Array([1, 2, 3, 4]);
    const b = new Float32Array([1, 2, 3, 4]);
    const sim = cosineSimilarity(a, b);
    assert.ok(Math.abs(sim - 1.0) < 0.0001);
  });

  it("cosineSimilarity should return 0 for orthogonal vectors", () => {
    const a = new Float32Array([1, 0, 0, 0]);
    const b = new Float32Array([0, 1, 0, 0]);
    const sim = cosineSimilarity(a, b);
    assert.ok(Math.abs(sim) < 0.0001);
  });

  it("cosineSimilarity should throw on dimension mismatch", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2]);
    assert.throws(() => cosineSimilarity(a, b), /Dimension mismatch/);
  });

  it("cosineSimilarity should return 0 for zero vectors", () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 2, 3]);
    const sim = cosineSimilarity(a, b);
    assert.strictEqual(sim, 0);
  });

  it("bufferToFloat32Array should correctly convert Buffer", () => {
    const original = new Float32Array([1.5, -2.5, 3.14, 0]);
    const buf = Buffer.from(original.buffer, original.byteOffset, original.byteLength);
    const result = bufferToFloat32Array(buf);
    assert.strictEqual(result.length, 4);
    assert.ok(Math.abs(result[0] - 1.5) < 0.001);
    assert.ok(Math.abs(result[2] - 3.14) < 0.01);
  });
});

describe("Vector Search with DB", () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  before(async () => {
    const server = await createTestServer();
    app = server.app;
    cleanup = server.cleanup;
    await app.ready();

    // Create issues with known embeddings
    const memo1 = createMemo(app.db, { bodyMd: "Cooking recipes" });
    const memo2 = createMemo(app.db, { bodyMd: "Programming tutorials" });
    const memo3 = createMemo(app.db, { bodyMd: "Travel plans" });

    // Embed with distinctive vectors
    const vec1 = new Float32Array([1, 0, 0, 0]);
    const vec2 = new Float32Array([0, 1, 0, 0]);
    const vec3 = new Float32Array([0.9, 0.1, 0, 0]); // Similar to vec1

    upsertEmbedding(app.db, memo1.id, Buffer.from(vec1.buffer), "test", 4, "h1");
    upsertEmbedding(app.db, memo2.id, Buffer.from(vec2.buffer), "test", 4, "h2");
    upsertEmbedding(app.db, memo3.id, Buffer.from(vec3.buffer), "test", 4, "h3");
  });

  after(async () => {
    await cleanup();
  });

  it("should rank similar vectors higher", () => {
    const query = new Float32Array([1, 0, 0, 0]);
    const results = searchByVector(app.db, query, { limit: 10 });

    assert.ok(results.length >= 3);
    // memo1 (exact match) and memo3 (similar) should rank above memo2 (orthogonal)
    assert.ok(results[0].score > results[results.length - 1].score);
  });

  it("should respect limit", () => {
    const query = new Float32Array([1, 0, 0, 0]);
    const results = searchByVector(app.db, query, { limit: 1 });
    assert.strictEqual(results.length, 1);
  });

  it("should filter by type", () => {
    const task = createTask(app.db, { title: "Test task", bodyMd: "" });
    const vec = new Float32Array([1, 0, 0, 0]);
    upsertEmbedding(app.db, task.id, Buffer.from(vec.buffer), "test", 4, "ht");

    const results = searchByVector(app.db, vec, { limit: 10, types: ["task"] });
    assert.ok(results.every((r) => r.issueType === "task"));
  });
});

describe("Content Hash", () => {
  it("should produce consistent hash for same content", () => {
    const h1 = computeContentHash("title", "body");
    const h2 = computeContentHash("title", "body");
    assert.strictEqual(h1, h2);
  });

  it("should produce different hash for different content", () => {
    const h1 = computeContentHash("title", "body1");
    const h2 = computeContentHash("title", "body2");
    assert.notStrictEqual(h1, h2);
  });

  it("should handle null title", () => {
    const h1 = computeContentHash(null, "body");
    const h2 = computeContentHash("", "body");
    // Both null and "" are falsy, so both produce hash of just "body"
    assert.strictEqual(h1, h2);
  });

  it("should include title in hash when present", () => {
    const h1 = computeContentHash("title", "body");
    const h2 = computeContentHash(null, "body");
    assert.notStrictEqual(h1, h2);
  });
});
