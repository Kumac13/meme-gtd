import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ensureDatabase, searchByKeyword } from 'meme-gtd-db';

export default class SearchKeyword extends Command {
  static summary = 'Search by keyword across all issue types';
  static description = 'Search memos, tasks, and articles by keyword using partial text matching. Searches title, body, and comments.';
  static usage = ['<%= command.id %> <query> [--types <types>] [--limit <n>] [--json]'];
  static examples = [
    '$ mgtd search keyword "郡司ペギオ"',
    '$ mgtd search keyword "TODO" --types memo,task',
    '$ mgtd search keyword "meeting" --limit 5 --json',
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
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Format the output as JSON for programmatic consumption.',
      default: false,
    }),
  } as const;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SearchKeyword);
    const { config } = await loadConfig({ createIfMissing: true });
    const db = ensureDatabase(config);

    try {
      const types = flags.types
        ? flags.types.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined;

      const results = searchByKeyword(db, args.query, {
        types,
        limit: flags.limit,
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
        const statusLabel = result.status ? `  [${result.status}]` : '';
        const date = result.updatedAt.split('T')[0];

        // Show issue header
        const issueMatch = result.matches.find((m) => m.field === 'issue');
        if (result.title) {
          this.log(`${indicator} #${result.id}  ${typeLabel}${statusLabel}  ${result.title}`);
          if (issueMatch && issueMatch.text !== result.title) {
            this.log(`                ${issueMatch.text}`);
          }
        } else if (issueMatch) {
          this.log(`${indicator} #${result.id}  ${typeLabel}  ${issueMatch.text}`);
        } else {
          // Only comment matches, show parent context
          const parentContext = result.title ?? result.bodyMd.split('\n')[0].slice(0, 60);
          this.log(`${indicator} #${result.id}  ${typeLabel}${statusLabel}  ${parentContext}`);
        }

        // Show comment matches
        const commentMatches = result.matches.filter((m) => m.field === 'comment');
        for (const cm of commentMatches) {
          this.log(`                comment #${cm.commentId}: ${cm.text}`);
        }

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
