import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Buffer } from 'node:buffer';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

/**
 * Create a minimal PNG file buffer (1x1 transparent pixel)
 */
function createTestPngBuffer(): Buffer {
  // Minimal valid PNG: 1x1 transparent pixel
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk header
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, // 8-bit RGBA
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk header
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, // compressed data
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, // checksum
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND chunk
    0x42, 0x60, 0x82, // IEND CRC
  ]);
}

/**
 * Create a multipart/form-data body for file upload
 */
function createMultipartBody(
  filename: string,
  contentType: string,
  fileBuffer: Buffer
): { body: Buffer; boundary: string } {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const crlf = '\r\n';

  const parts: Buffer[] = [];

  // File part (field name: "image" for OCR endpoint)
  parts.push(Buffer.from(
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="image"; filename="${filename}"${crlf}` +
    `Content-Type: ${contentType}${crlf}${crlf}`
  ));
  parts.push(fileBuffer);
  parts.push(Buffer.from(crlf));

  // End boundary
  parts.push(Buffer.from(`--${boundary}--${crlf}`));

  return {
    body: Buffer.concat(parts),
    boundary,
  };
}

describe('OCR Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testServer = await createTestServer();
    app = testServer.app;
    cleanup = testServer.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should extract text from an image (POST /api/ocr)', async () => {
    const pngBuffer = createTestPngBuffer();
    const { body, boundary } = createMultipartBody('test.png', 'image/png', pngBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/api/ocr',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}: ${response.body}`);
    const result = JSON.parse(response.body);

    // Response should have the expected shape
    assert.ok('text' in result, 'Should have text field');
    assert.ok('regions' in result, 'Should have regions field');
    assert.ok('processingTimeMs' in result, 'Should have processingTimeMs field');
    assert.ok(Array.isArray(result.regions), 'regions should be an array');
    assert.ok(typeof result.processingTimeMs === 'number', 'processingTimeMs should be a number');
    // A 1x1 pixel image should have no text (empty string is acceptable)
    assert.ok(typeof result.text === 'string', 'text should be a string');
  });

  it('should reject non-image file types', async () => {
    const textBuffer = Buffer.from('Hello, world!');
    const { body, boundary } = createMultipartBody('test.txt', 'text/plain', textBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/api/ocr',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'INVALID_IMAGE');
    assert.ok(error.message.includes('PNG, JPEG, GIF, WebP'));
  });

  it('should reject request without file', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/ocr',
      headers: {
        'content-type': 'multipart/form-data; boundary=----test',
      },
      payload: Buffer.from('------test--\r\n'),
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'INVALID_IMAGE');
    assert.ok(error.message.toLowerCase().includes('no image'));
  });

  it('should handle JPEG images', async () => {
    // Minimal JPEG (not valid image but valid MIME detection)
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
    const { body, boundary } = createMultipartBody('test.jpg', 'image/jpeg', jpegBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/api/ocr',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    // JPEG should be accepted (even if OCR fails on minimal image, it should not be a 400)
    // The minimal JPEG might cause OCR to fail, so we accept either 200 or 500 (OCR_FAILED)
    // but NOT 400 (INVALID_IMAGE)
    if (response.statusCode === 400) {
      const error = JSON.parse(response.body);
      assert.notStrictEqual(error.code, 'INVALID_IMAGE', 'JPEG should be accepted as valid image format');
    }
  });

  it('should handle GIF images', async () => {
    // Minimal GIF
    const gifBuffer = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      0x01, 0x00, 0x01, 0x00, // 1x1 dimensions
      0x00, 0x00, 0x00, // GCT
      0x2c, 0x00, 0x00, 0x00, 0x00, // Image descriptor
      0x01, 0x00, 0x01, 0x00, 0x00, // 1x1
      0x02, 0x01, 0x44, 0x00, 0x3b, // Image data + trailer
    ]);
    const { body, boundary } = createMultipartBody('test.gif', 'image/gif', gifBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/api/ocr',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    // GIF should be accepted
    if (response.statusCode === 400) {
      const error = JSON.parse(response.body);
      assert.notStrictEqual(error.code, 'INVALID_IMAGE', 'GIF should be accepted as valid image format');
    }
  });

  it('should handle WebP images', async () => {
    // Minimal WebP (RIFF header + WEBP)
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x1a, 0x00, 0x00, 0x00, // File size
      0x57, 0x45, 0x42, 0x50, // WEBP
      0x56, 0x50, 0x38, 0x20, // VP8
      0x0e, 0x00, 0x00, 0x00, // Chunk size
      0x30, 0x01, 0x00, 0x9d, // VP8 bitstream
      0x01, 0x2a, 0x01, 0x00, // Width/height
      0x01, 0x00, 0x02, 0x00, // Image data
      0x34, 0x25, // CRC
    ]);
    const { body, boundary } = createMultipartBody('test.webp', 'image/webp', webpBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/api/ocr',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    // WebP should be accepted
    if (response.statusCode === 400) {
      const error = JSON.parse(response.body);
      assert.notStrictEqual(error.code, 'INVALID_IMAGE', 'WebP should be accepted as valid image format');
    }
  });
});
