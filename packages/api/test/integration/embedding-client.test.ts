/* eslint-disable no-undef */
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  generateEmbedding,
  generateEmbeddings,
  checkEmbeddingHealth,
  loadEmbeddingConfig,
  type EmbeddingClientConfig,
} from "meme-gtd-core";

const testConfig: EmbeddingClientConfig = {
  baseUrl: "http://test-server:8080/v1",
  model: "test-model",
  apiKey: "test-key",
};

describe("Embedding Client (OpenAI-compatible API)", () => {
  let fetchMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    fetchMock = mock.fn();
    mock.method(globalThis, "fetch", fetchMock);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("generateEmbedding should POST to /v1/embeddings with correct body", async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3];
    fetchMock.mock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ data: [{ embedding: fakeEmbedding, index: 0 }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await generateEmbedding("hello world", testConfig);

    assert.strictEqual(fetchMock.mock.callCount(), 1);
    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.strictEqual(url, "http://test-server:8080/v1/embeddings");
    assert.strictEqual(options.method, "POST");

    const body = JSON.parse(options.body);
    assert.strictEqual(body.model, "test-model");
    assert.strictEqual(body.input, "hello world");
  });

  it("generateEmbedding should send Authorization: Bearer header", async () => {
    fetchMock.mock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ data: [{ embedding: [0.1], index: 0 }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await generateEmbedding("test", testConfig);

    const [, options] = fetchMock.mock.calls[0].arguments;
    assert.strictEqual(options.headers["Authorization"], "Bearer test-key");
    assert.strictEqual(options.headers["Content-Type"], "application/json");
  });

  it("generateEmbedding should not send Authorization header when apiKey is undefined", async () => {
    fetchMock.mock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ data: [{ embedding: [0.1], index: 0 }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const configWithoutKey: EmbeddingClientConfig = {
      baseUrl: "http://test-server:8080/v1",
      model: "test-model",
    };
    await generateEmbedding("test", configWithoutKey);

    const [, options] = fetchMock.mock.calls[0].arguments;
    assert.strictEqual(options.headers["Authorization"], undefined);
  });

  it("generateEmbedding should convert OpenAI response to Float32Array", async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3, 0.4];
    fetchMock.mock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ data: [{ embedding: fakeEmbedding, index: 0 }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const result = await generateEmbedding("test", testConfig);

    assert.ok(result instanceof Float32Array);
    assert.strictEqual(result.length, 4);
    assert.ok(Math.abs(result[0] - 0.1) < 0.001);
    assert.ok(Math.abs(result[3] - 0.4) < 0.001);
  });

  it("generateEmbeddings (batch) should send input array and return multiple Float32Arrays", async () => {
    const fakeResponse = {
      data: [
        { embedding: [0.1, 0.2], index: 0 },
        { embedding: [0.3, 0.4], index: 1 },
      ],
    };
    fetchMock.mock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(fakeResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const results = await generateEmbeddings(["text1", "text2"], testConfig);

    assert.strictEqual(results.length, 2);
    assert.ok(results[0] instanceof Float32Array);
    assert.ok(results[1] instanceof Float32Array);
    assert.strictEqual(results[0].length, 2);
    assert.ok(Math.abs(results[0][0] - 0.1) < 0.001);
    assert.ok(Math.abs(results[1][0] - 0.3) < 0.001);

    // Verify request body has input as array
    const [, options] = fetchMock.mock.calls[0].arguments;
    const body = JSON.parse(options.body);
    assert.deepStrictEqual(body.input, ["text1", "text2"]);
  });

  it("generateEmbeddings should sort response by index", async () => {
    // Response with reversed index order
    const fakeResponse = {
      data: [
        { embedding: [0.3, 0.4], index: 1 },
        { embedding: [0.1, 0.2], index: 0 },
      ],
    };
    fetchMock.mock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(fakeResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const results = await generateEmbeddings(["text1", "text2"], testConfig);

    // Should be sorted by index, not by response order
    assert.ok(Math.abs(results[0][0] - 0.1) < 0.001);
    assert.ok(Math.abs(results[1][0] - 0.3) < 0.001);
  });

  it("generateEmbedding should throw on HTTP error", async () => {
    fetchMock.mock.mockImplementation(() =>
      Promise.resolve(
        new Response("model not found", { status: 404, statusText: "Not Found" })
      )
    );

    await assert.rejects(
      () => generateEmbedding("test", testConfig),
      (err: Error) => {
        assert.ok(err.message.includes("Embedding request failed"));
        assert.ok(err.message.includes("404"));
        return true;
      }
    );
  });

  it("checkEmbeddingHealth should GET /v1/models and return true on success", async () => {
    fetchMock.mock.mockImplementation(() =>
      Promise.resolve(new Response("OK", { status: 200 }))
    );

    const result = await checkEmbeddingHealth("http://test-server:8080/v1", "test-key");
    assert.strictEqual(result, true);

    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.strictEqual(url, "http://test-server:8080/v1/models");
    assert.strictEqual(options.headers["Authorization"], "Bearer test-key");
  });

  it("checkEmbeddingHealth should return false on connection failure", async () => {
    fetchMock.mock.mockImplementation(() =>
      Promise.reject(new Error("ECONNREFUSED"))
    );

    const result = await checkEmbeddingHealth("http://unreachable:8080/v1");
    assert.strictEqual(result, false);
  });
});

describe("loadEmbeddingConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should load config from environment variables", () => {
    process.env.MGTD_EMBEDDING_URL = "http://myserver:8080/v1";
    process.env.MGTD_EMBEDDING_MODEL = "my-model";
    process.env.MGTD_EMBEDDING_API_KEY = "my-key";

    const config = loadEmbeddingConfig();
    assert.strictEqual(config.baseUrl, "http://myserver:8080/v1");
    assert.strictEqual(config.model, "my-model");
    assert.strictEqual(config.apiKey, "my-key");
  });

  it("should throw when MGTD_EMBEDDING_URL is not set", () => {
    delete process.env.MGTD_EMBEDDING_URL;
    process.env.MGTD_EMBEDDING_MODEL = "my-model";

    assert.throws(
      () => loadEmbeddingConfig(),
      (err: Error) => {
        assert.ok(err.message.includes("MGTD_EMBEDDING_URL"));
        assert.ok(err.message.includes("not configured"));
        return true;
      }
    );
  });

  it("should throw when MGTD_EMBEDDING_MODEL is not set", () => {
    process.env.MGTD_EMBEDDING_URL = "http://myserver:8080/v1";
    delete process.env.MGTD_EMBEDDING_MODEL;

    assert.throws(
      () => loadEmbeddingConfig(),
      (err: Error) => {
        assert.ok(err.message.includes("MGTD_EMBEDDING_MODEL"));
        return true;
      }
    );
  });

  it("should allow modelOverride to take precedence", () => {
    process.env.MGTD_EMBEDDING_URL = "http://myserver:8080/v1";
    process.env.MGTD_EMBEDDING_MODEL = "env-model";

    const config = loadEmbeddingConfig("override-model");
    assert.strictEqual(config.model, "override-model");
  });

  it("should work without MGTD_EMBEDDING_API_KEY (optional)", () => {
    process.env.MGTD_EMBEDDING_URL = "http://myserver:8080/v1";
    process.env.MGTD_EMBEDDING_MODEL = "my-model";
    delete process.env.MGTD_EMBEDDING_API_KEY;

    const config = loadEmbeddingConfig();
    assert.strictEqual(config.apiKey, undefined);
  });
});
