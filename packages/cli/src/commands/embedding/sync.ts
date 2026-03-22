import { Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ensureDatabase } from 'meme-gtd-db';
import {
  syncEmbeddings,
  DEFAULT_EMBEDDING_CONFIG,
} from 'meme-gtd-core';

export default class EmbeddingSync extends Command {
  static summary = 'Sync embeddings for all issues';
  static description = `Generate or update vector embeddings for all issues using Ollama.

Embeddings are generated for issues that:
- Have no embedding yet
- Have been updated since last embedding (content hash changed)
- Were embedded with a different model

Requires Ollama to be running with the target model pulled.`;

  static usage = ['<%= command.id %> [--model <model>] [--ollama-url <url>] [--json]'];
  static examples = [
    '$ mgtd embedding sync',
    '$ mgtd embedding sync --model qwen3-embedding:0.6b',
    '$ mgtd embedding sync --ollama-url http://192.168.1.100:11434',
    '$ mgtd embedding sync --json'
  ];

  static flags = {
    model: Flags.string({
      char: 'm',
      summary: 'Ollama embedding model name',
      description: 'The Ollama model to use for embedding generation.',
      default: DEFAULT_EMBEDDING_CONFIG.model,
    }),
    'ollama-url': Flags.string({
      summary: 'Ollama server URL',
      description: 'Base URL of the Ollama server.',
      default: DEFAULT_EMBEDDING_CONFIG.baseUrl,
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return structured JSON output',
      description: 'Format the output as JSON for programmatic consumption.',
      default: false,
    }),
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(EmbeddingSync);

    const { config: currentConfig } = await loadConfig({ createIfMissing: false });
    const db = ensureDatabase(currentConfig);

    const embeddingConfig = {
      baseUrl: flags['ollama-url'],
      model: flags.model,
    };

    try {
      const result = await syncEmbeddings(db, {
        config: embeddingConfig,
        onProgress: (current, total) => {
          if (!flags.json) {
            process.stdout.write(`\rProcessing ${current}/${total}...`);
          }
        },
      });

      if (flags.json) {
        this.log(JSON.stringify({
          success: true,
          model: embeddingConfig.model,
          ...result,
        }, null, 2));
      } else {
        if (result.total > 0) {
          process.stdout.write('\r');
        }
        this.log(`Embedding sync complete (model: ${embeddingConfig.model})`);
        this.log(`  Created: ${result.created}`);
        this.log(`  Updated: ${result.updated}`);
        this.log(`  Total processed: ${result.total}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: message }, null, 2));
      } else {
        this.error(message);
      }
    } finally {
      db.close();
    }
  }
}
