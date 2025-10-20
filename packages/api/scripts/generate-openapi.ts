#!/usr/bin/env tsx
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { stringify } from 'yaml';
import { buildApp } from '../src/server.js';
import { loadConfig } from '../src/config.js';

/**
 * Generate OpenAPI specification file from the application
 */
async function generateOpenAPI() {
  try {
    console.log('Loading configuration...');
    const config = await loadConfig();

    console.log('Building Fastify application...');
    const app = await buildApp({
      config: config.mgtdConfig,
      corsAllowedOrigins: ['*'],
      logger: {
        level: 'error', // Suppress logs during generation
      },
    });

    console.log('Waiting for application to be ready...');
    await app.ready();

    console.log('Generating OpenAPI specification...');
    const spec = app.swagger();

    // Convert to YAML
    const yamlContent = stringify(spec, {
      lineWidth: 0, // Don't wrap lines
      indent: 2,
    });

    // Ensure output directory exists
    const outputPath = 'docs/api/openapi.yaml';
    mkdirSync(dirname(outputPath), { recursive: true });

    // Write to file
    writeFileSync(outputPath, yamlContent, 'utf-8');

    console.log(`✓ OpenAPI spec generated: ${outputPath}`);
    console.log(`  - ${Object.keys(spec.paths || {}).length} paths`);
    console.log(`  - ${Object.keys(spec.components?.schemas || {}).length} schemas`);

    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Failed to generate OpenAPI spec:', error);
    process.exit(1);
  }
}

generateOpenAPI();
