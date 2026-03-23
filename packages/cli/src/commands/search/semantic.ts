import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ensureDatabase, getIssueLabels, getIssueComments } from 'meme-gtd-db';
import {
  checkEmbeddingHealth,
  generateEmbedding,
  searchByVector,
  loadEmbeddingConfig,
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
  static description = `Search memos, tasks, and articles using vector similarity via OpenAI-compatible embeddings.

Configure the embedding server via environment variables or ~/.config/mgtd/.env:
  MGTD_EMBEDDING_URL    - OpenAI-compatible embeddings endpoint (default: http://localhost:11434/v1)
  MGTD_EMBEDDING_MODEL  - Model name (default: qwen3-embedding:4b)
  MGTD_EMBEDDING_API_KEY - API key (default: ollama)`;
  static usage = ['<%= command.id %> <query> [--types <types>] [--limit <n>] [--model <model>] [--json]'];
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
      summary: 'Embedding model name (overrides MGTD_EMBEDDING_MODEL env var)',
      description: 'The model to use for query embedding. Overrides the MGTD_EMBEDDING_MODEL environment variable.',
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

    const embeddingConfig = loadEmbeddingConfig(flags.model);

    try {
      if (!flags.json) {
        process.stdout.write('Searching...');
      }

      const healthy = await checkEmbeddingHealth(embeddingConfig.baseUrl, embeddingConfig.apiKey);
      if (!healthy) {
        if (!flags.json) {
          process.stdout.write('\r');
        }
        throw new Error(
          `Cannot connect to embedding server at ${embeddingConfig.baseUrl}. Ensure the server is running and the model "${embeddingConfig.model}" is available.`
        );
      }

      const queryText = embeddingConfig.queryPrefix ? `${embeddingConfig.queryPrefix}${args.query}` : args.query;
      const queryEmbedding = await generateEmbedding(queryText, embeddingConfig);

      const types = flags.types
        ? flags.types.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined;

      const scored = searchByVector(db, queryEmbedding, {
        limit: flags.limit,
        types,
      });

      if (scored.length === 0) {
        if (!flags.json) {
          process.stdout.write('\r\x1b[K');
        }
        if (flags.json) {
          this.log(JSON.stringify({ results: [], total: 0 }, null, 2));
        } else {
          this.log('No results found.');
        }
        return;
      }

      const issueIds = scored.map((s) => s.issueId);
      const placeholders = issueIds.map(() => '?').join(',');

      // Batch fetch issue details
      const issueRows = db
        .prepare(`SELECT id, type, title, body_md, status, is_bookmarked, created_at, updated_at FROM issues WHERE id IN (${placeholders})`)
        .all(...issueIds) as any[];
      const issueMap = new Map(issueRows.map((r) => [r.id, r]));

      // Batch fetch comments
      const commentRows = db
        .prepare(`SELECT id, issue_id, body_md, created_at, updated_at FROM comments WHERE issue_id IN (${placeholders}) AND is_deleted = 0 ORDER BY created_at ASC`)
        .all(...issueIds) as any[];
      const commentMap = new Map<number, any[]>();
      for (const c of commentRows) {
        const list = commentMap.get(c.issue_id) ?? [];
        list.push({ id: c.id, bodyMd: c.body_md, createdAt: c.created_at, updatedAt: c.updated_at });
        commentMap.set(c.issue_id, list);
      }

      // Batch fetch labels
      const labelRows = db
        .prepare(`SELECT il.issue_id, l.name FROM labels l JOIN issue_labels il ON il.label_id = l.id WHERE il.issue_id IN (${placeholders}) ORDER BY l.name`)
        .all(...issueIds) as any[];
      const labelMap = new Map<number, string[]>();
      for (const l of labelRows) {
        const list = labelMap.get(l.issue_id) ?? [];
        list.push(l.name);
        labelMap.set(l.issue_id, list);
      }

      const results: SemanticSearchResult[] = scored.map((s) => {
        const row = issueMap.get(s.issueId)!;
        const comments = commentMap.get(s.issueId) ?? [];
        return {
          id: row.id,
          type: row.type,
          title: row.title,
          bodyMd: row.body_md,
          status: row.status,
          isBookmarked: row.is_bookmarked === 1,
          labels: labelMap.get(row.id) ?? [],
          comments,
          commentCount: comments.length,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          score: Math.round(s.score * 100) / 100,
        };
      });

      if (!flags.json) {
        process.stdout.write('\r\x1b[K');
      }

      if (flags.json) {
        this.log(JSON.stringify({ results, total: results.length }, null, 2));
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
