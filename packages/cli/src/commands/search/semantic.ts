import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ensureDatabase, getIssueLabels, getIssueComments } from 'meme-gtd-db';
import {
  checkOllamaHealth,
  generateEmbedding,
  formatQueryText,
  searchByVector,
  DEFAULT_EMBEDDING_CONFIG,
} from 'meme-gtd-core';

interface SemanticSearchResult {
  id: number;
  type: string;
  title: string | null;
  bodyMd: string;
  status: string | null;
  isBookmarked: boolean;
  labels: string[];
  comments: Array<{ id: number; bodyMd: string; createdAt: string; updatedAt: string }>;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  score: number;
}

export default class SearchSemantic extends Command {
  static summary = 'Search by semantic similarity across all issue types';
  static description = 'Search memos, tasks, and articles using vector similarity via Ollama embeddings. Requires Ollama to be running with the embedding model pulled.';
  static usage = ['<%= command.id %> <query> [--types <types>] [--limit <n>] [--model <model>] [--ollama-url <url>] [--json]'];
  static examples = [
    '$ mgtd search semantic "郡司ペギオ"',
    '$ mgtd search semantic "GTD workflow" --types task --limit 10',
    '$ mgtd search semantic "読書メモ" --json',
  ];

  static args = {
    query: Args.string({ description: 'Search query', required: true }),
  } as const;

  static flags = {
    types: Flags.string({
      char: 't',
      summary: 'Filter by issue types',
      description: 'Comma-separated list of issue types to search: memo, task, article.',
    }),
    limit: Flags.integer({
      char: 'n',
      summary: 'Maximum number of results',
      description: 'Limit the number of search results.',
      default: 20,
    }),
    model: Flags.string({
      char: 'm',
      summary: 'Ollama embedding model name',
      description: 'The Ollama model to use for query embedding.',
      default: DEFAULT_EMBEDDING_CONFIG.model,
    }),
    'ollama-url': Flags.string({
      summary: 'Ollama server URL',
      description: 'Base URL of the Ollama server.',
      default: DEFAULT_EMBEDDING_CONFIG.baseUrl,
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Format the output as JSON for programmatic consumption.',
      default: false,
    }),
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SearchSemantic);
    const { config } = await loadConfig({ createIfMissing: true });
    const db = ensureDatabase(config);

    const embeddingConfig = {
      baseUrl: flags['ollama-url'],
      model: flags.model,
    };

    try {
      const healthy = await checkOllamaHealth(embeddingConfig.baseUrl);
      if (!healthy) {
        throw new Error(
          `Cannot connect to Ollama at ${embeddingConfig.baseUrl}. Ensure Ollama is running (ollama serve) and the model is pulled (ollama pull ${embeddingConfig.model}).`
        );
      }

      const queryText = formatQueryText(args.query);
      const queryEmbedding = await generateEmbedding(queryText, embeddingConfig);

      const types = flags.types
        ? flags.types.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined;

      const scored = searchByVector(db, queryEmbedding, {
        limit: flags.limit,
        types,
      });

      const results: SemanticSearchResult[] = scored.map((s) => {
        const row = db
          .prepare('SELECT id, type, title, body_md, status, is_bookmarked, created_at, updated_at FROM issues WHERE id = ?')
          .get(s.issueId) as any;

        const comments = getIssueComments(db, s.issueId);

        return {
          id: row.id,
          type: row.type,
          title: row.title,
          bodyMd: row.body_md,
          status: row.status,
          isBookmarked: row.is_bookmarked === 1,
          labels: getIssueLabels(db, row.id),
          comments: comments.map((c) => ({
            id: c.id,
            bodyMd: c.bodyMd,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })),
          commentCount: comments.length,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          score: Math.round(s.score * 100) / 100,
        };
      });

      if (flags.json) {
        this.log(JSON.stringify({ results, total: results.length }, null, 2));
        return;
      }

      if (results.length === 0) {
        this.log('No results found.');
        return;
      }

      for (const result of results) {
        const indicator = result.isBookmarked ? '★' : ' ';
        const typeLabel = `[${result.type}]`;
        const score = result.score.toFixed(2);
        const date = result.updatedAt.split('T')[0];
        const content = result.title ?? result.bodyMd;

        this.log(`${indicator} #${result.id}  ${typeLabel}  ${score}  ${content}`);
        this.log(`                ${' '.repeat(40)}${date}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({ error: message }, null, 2));
      } else {
        this.error(message);
      }
    } finally {
      db.close();
    }
  }
}
