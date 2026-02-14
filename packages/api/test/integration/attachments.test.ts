import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Buffer } from 'node:buffer';
import { existsSync, unlinkSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  // File part
  parts.push(Buffer.from(
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${crlf}` +
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

/**
 * Track files created during each test for cleanup
 * IMPORTANT: Only delete files that were created during the test, never touch existing files
 */
const testCreatedFiles: string[] = [];

/**
 * Clean up only the files that were created during the current test
 * This prevents accidentally deleting production attachment files
 */
function cleanupAttachments(): void {
  for (const filePath of testCreatedFiles) {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
  testCreatedFiles.length = 0;
}

/**
 * Track a file for cleanup after the test
 */
function trackFileForCleanup(filePath: string): void {
  testCreatedFiles.push(filePath);
}

describe('Attachment Upload Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;
  let previousAttachmentsDir: string | undefined;

  beforeEach(async () => {
    previousAttachmentsDir = process.env.MGTD_ATTACHMENTS_DIR;
    const testBaseDir = mkdtempSync(join(tmpdir(), 'mgtd-attachments-test-'));
    process.env.MGTD_ATTACHMENTS_DIR = join(testBaseDir, '.mgtd', 'attachments');

    const testServer = await createTestServer();
    app = testServer.app;
    cleanup = testServer.cleanup;
  });

  afterEach(async () => {
    cleanupAttachments();
    await cleanup();
    if (previousAttachmentsDir === undefined) {
      delete process.env.MGTD_ATTACHMENTS_DIR;
    } else {
      process.env.MGTD_ATTACHMENTS_DIR = previousAttachmentsDir;
    }
  });

  it('should upload a PNG image (POST /api/attachments)', async () => {
    const pngBuffer = createTestPngBuffer();
    const { body, boundary } = createMultipartBody('test.png', 'image/png', pngBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    assert.strictEqual(response.statusCode, 201, `Expected 201, got ${response.statusCode}: ${response.body}`);
    const result = JSON.parse(response.body);

    assert.ok(result.id, 'Should have id');
    assert.ok(result.filename.endsWith('.png'), 'Filename should end with .png');
    assert.ok(result.absolutePath.includes('.mgtd/attachments'), 'Path should include .mgtd/attachments');
    assert.ok(!result.absolutePath.includes('/1/'), 'Path should NOT include issueId subdirectory');
    assert.ok(result.markdownRef.startsWith('![image]('), 'markdownRef should be markdown format');
    assert.strictEqual(result.mimeType, 'image/png');
    assert.ok(result.size > 0, 'Size should be positive');

    // Track file for cleanup
    trackFileForCleanup(result.absolutePath);

    // Verify file was actually created
    assert.ok(existsSync(result.absolutePath), 'File should exist on disk');
  });

  it('should reject non-image file types', async () => {
    const textBuffer = Buffer.from('Hello, world!');
    const { body, boundary } = createMultipartBody('test.txt', 'text/plain', textBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'INVALID_FILE_TYPE');
    assert.ok(error.message.includes('PNG, JPEG, GIF, WebP'));
  });

  it('should reject request without file', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: {
        'content-type': 'multipart/form-data; boundary=----test',
      },
      payload: Buffer.from('------test--\r\n'),
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NO_FILE_UPLOADED');
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
      url: '/api/attachments',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    assert.strictEqual(response.statusCode, 201);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.mimeType, 'image/jpeg');
    assert.ok(result.filename.endsWith('.jpg'));

    // Track file for cleanup
    trackFileForCleanup(result.absolutePath);
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
      url: '/api/attachments',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    assert.strictEqual(response.statusCode, 201);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.mimeType, 'image/gif');

    // Track file for cleanup
    trackFileForCleanup(result.absolutePath);
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
      url: '/api/attachments',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    assert.strictEqual(response.statusCode, 201);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.mimeType, 'image/webp');

    // Track file for cleanup
    trackFileForCleanup(result.absolutePath);
  });
});

describe('Attachment Download Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;
  let uploadedFilename: string;
  let previousAttachmentsDir: string | undefined;

  beforeEach(async () => {
    previousAttachmentsDir = process.env.MGTD_ATTACHMENTS_DIR;
    const testBaseDir = mkdtempSync(join(tmpdir(), 'mgtd-attachments-test-'));
    process.env.MGTD_ATTACHMENTS_DIR = join(testBaseDir, '.mgtd', 'attachments');

    const testServer = await createTestServer();
    app = testServer.app;
    cleanup = testServer.cleanup;

    // Upload a test image
    const pngBuffer = createTestPngBuffer();
    const { body, boundary } = createMultipartBody('test.png', 'image/png', pngBuffer);

    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });
    const uploadResult = JSON.parse(uploadResponse.body);
    uploadedFilename = uploadResult.filename;

    // Track file for cleanup
    trackFileForCleanup(uploadResult.absolutePath);
  });

  afterEach(async () => {
    cleanupAttachments();
    await cleanup();
    if (previousAttachmentsDir === undefined) {
      delete process.env.MGTD_ATTACHMENTS_DIR;
    } else {
      process.env.MGTD_ATTACHMENTS_DIR = previousAttachmentsDir;
    }
  });

  it('should download an uploaded image (GET /api/attachments/:filename)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/attachments/${uploadedFilename}`,
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.headers['content-type'], 'image/png');
    assert.ok(response.headers['cache-control']?.includes('max-age'));
    assert.ok(response.rawPayload.length > 0);
  });

  it('should return 404 for non-existent file', async () => {
    // Use a valid UUID format filename that doesn't exist
    const response = await app.inject({
      method: 'GET',
      url: '/api/attachments/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png',
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'FILE_NOT_FOUND');
  });

  it('should reject invalid filename format (path traversal attempt)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/attachments/invalid-filename',
    });

    // Should fail due to invalid filename pattern (missing extension)
    assert.strictEqual(response.statusCode, 400);
  });

  it('should reject filenames with invalid characters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/attachments/test%20file.png',
    });

    // Should fail due to invalid filename pattern (space is not allowed)
    assert.strictEqual(response.statusCode, 400);
  });
});
