import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';
import { loadBodyFromFile } from '../../lib/io.js';
import { promptEditor } from '../../lib/editor.js';
import { detectLegacyFlags, formatLegacyFlagError } from '../../lib/legacy-flags.js';

export default class TaskDemote extends Command {
  static summary = 'Demote a task to a memo';
  static description =
    'Copy task content (title, body, comments) to create a new memo. The original task remains unchanged.';
  static usage = [
    '<%= command.id %> <taskId> [--body <text> | --body-file <path>]',
    '<%= command.id %> <taskId> [--label <name> ...] [--no-editor] [--json]'
  ];
  static examples = [
    '$ mgtd task demote 21',
    '$ mgtd task demote 8 --body-file notes.md --label documentation',
    '$ mgtd task demote 5 --no-editor --json'
  ];

  static args = {
    id: Args.integer({ description: 'Task ID', required: true })
  } as const;

  static flags = {
    body: Flags.string({
      char: 'b',
      summary: 'Override memo body inline',
      description: 'Provide Markdown content that will populate the memo body instead of auto-generated content.'
    }),
    'body-file': Flags.string({
      char: 'f',
      summary: 'Override memo body from file/stdin',
      description: 'Use "-" for stdin or pass a file with Markdown content.'
    }),
    label: Flags.string({
      char: 'l',
      summary: 'Labels to apply to the memo',
      description: 'Apply one or more labels to the resulting memo. If not specified, inherits from task.',
      multiple: true
    }),
    'no-editor': Flags.boolean({
      summary: 'Skip editor',
      description: 'Do not open an editor; use auto-generated or provided body directly.',
      default: false
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Return JSON output',
      description: 'Return the demoted task and new memo ID as JSON.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    // 旧フラグ検出
    const legacyResult = detectLegacyFlags({
      '--bodyFile': '--body-file',
      '--noEditor': '--no-editor'
    });

    if (legacyResult.detected) {
      this.error(formatLegacyFlagError(legacyResult));
    }

    const { args, flags } = await this.parse(TaskDemote);
    const { config } = await loadConfig({ createIfMissing: true });
    const service = new TaskService({ config });

    // タスクとコメントを取得して、デフォルトのbodyを組み立てる
    const task = service.show(args.id);
    const comments = service.listComments(args.id);

    // デフォルトbodyの生成
    const buildDefaultBody = (): string => {
      const parts: string[] = [];
      if (task.title) {
        parts.push(`# ${task.title}`);
        parts.push('');
      }
      if (task.bodyMd) {
        parts.push(task.bodyMd);
      }
      if (comments.length > 0) {
        parts.push('');
        parts.push('---');
        parts.push('## コメント');
        parts.push('');
        for (const comment of comments) {
          parts.push(`### ${comment.createdAt}`);
          parts.push(comment.bodyMd);
          parts.push('');
        }
      }
      return parts.join('\n').trim();
    };

    let body = flags.body;
    if (!body && flags['body-file']) {
      body = await loadBodyFromFile(flags['body-file']);
    }

    // --no-editorでない場合はエディタを開く
    if (!body && !flags['no-editor']) {
      const defaultBody = buildDefaultBody();
      body = await promptEditor(defaultBody);
    }

    // bodyが指定されていない場合はauto-generateされたbodyを使用（API側で生成）
    const result = service.demote({
      taskId: args.id,
      bodyMd: body,
      labels: flags.label
    });

    if (flags.json) {
      this.log(JSON.stringify({ task: result.task, memoId: result.memoId }, null, 2));
      return;
    }

    this.log(`Demoted task #${args.id} to memo #${result.memoId}`);
  }
}
