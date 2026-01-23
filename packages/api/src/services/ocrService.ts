/**
 * OCR Service - Singleton wrapper for @gutenye/ocr-node
 * Uses lazy initialization to load models only when first OCR request is made
 *
 * Current Limitation:
 * - Uses bundled PP-OCRv4 Chinese model (default from @gutenye/ocr-node)
 * - Kanji recognition works well, but Hiragana/Katakana recognition is limited
 * - TODO: Add proper Japanese model support (PP-OCRv5 from Hugging Face)
 */

import { Buffer } from 'node:buffer';
import type { OcrRegion, OcrResponse } from '../schemas/ocrSchemas.js';

// OCR instance type - using any to avoid moduleResolution issues with @gutenye/ocr-node
type OcrInstance = { detect: (input: Buffer) => Promise<unknown[]> };

let OcrClassRef: unknown = null;
let ocrInstance: OcrInstance | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the OCR engine (lazy loading)
 * Models are auto-loaded from @gutenye/ocr-models on first use
 */
async function initializeOcr(): Promise<void> {
  if (ocrInstance) return;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        // Dynamic import with type assertion to avoid moduleResolution issues
        // @ts-expect-error - moduleResolution mismatch with @gutenye/ocr-node
        const module = await import('@gutenye/ocr-node');
        OcrClassRef = module.default;
        // Use default models (PP-OCRv4 Chinese)
        const OcrClass = OcrClassRef as { create: () => Promise<OcrInstance> };
        ocrInstance = await OcrClass.create();
      } catch (error) {
        initPromise = null;
        throw error;
      }
    })();
  }

  await initPromise;
}

/**
 * Perform OCR on an image buffer
 * @param imageBuffer - Image data as Buffer (PNG, JPEG, GIF, WebP)
 * @returns OCR result with extracted text and regions
 */
export async function performOcr(imageBuffer: Buffer): Promise<OcrResponse> {
  const startTime = Date.now();

  // Initialize OCR engine if not already done
  await initializeOcr();

  if (!ocrInstance) {
    throw new Error('OCR engine not initialized');
  }

  // Perform OCR - handle errors gracefully for invalid/tiny images
  let result: Awaited<ReturnType<typeof ocrInstance.detect>>;
  try {
    result = await ocrInstance.detect(imageBuffer);
  } catch {
    // If OCR fails on the image (e.g., too small, corrupted), return empty result
    // This is not an error - the image just has no detectable text
    return {
      text: '',
      regions: [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Transform result to our schema format
  // OCR result item structure from @gutenye/ocr-node
  interface OcrResultItem {
    text: string;
    score?: number;
    box?: number[][];
  }
  const regions: OcrRegion[] = (result as OcrResultItem[]).map((item) => ({
    text: item.text,
    confidence: item.score ?? 0,
    bbox: {
      x: item.box?.[0]?.[0] ?? 0,
      y: item.box?.[0]?.[1] ?? 0,
      width: item.box ? Math.abs((item.box[1]?.[0] ?? 0) - (item.box[0]?.[0] ?? 0)) : 0,
      height: item.box ? Math.abs((item.box[2]?.[1] ?? 0) - (item.box[0]?.[1] ?? 0)) : 0,
    },
  }));

  // Combine all text with newlines
  const text = regions.map((r) => r.text).join('\n');

  return {
    text,
    regions,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Close the OCR engine and release resources
 * Should be called when the server shuts down
 */
export async function closeOcr(): Promise<void> {
  if (ocrInstance) {
    // The library doesn't expose a close method, but we can clear the reference
    ocrInstance = null;
    initPromise = null;
    OcrClassRef = null;
  }
}
