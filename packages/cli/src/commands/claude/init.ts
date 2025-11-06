import { Command, Flags } from '@oclif/core';
import fs from 'fs-extra';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export default class ClaudeInit extends Command {
  static summary = 'Install Claude Code slash commands';
  static description =
    'Copy meme-gtd slash command templates to ~/.claude/commands/ (global) or ./.claude/commands/ (local project).';

  static examples = [
    '$ mgtd claude init --global',
    '$ mgtd claude init',
    '$ mgtd claude init --target ~/my-project'
  ];

  static flags = {
    global: Flags.boolean({
      char: 'g',
      summary: 'Install globally to ~/.claude/commands/',
      description: 'Install commands to your home directory so they are available in all projects.',
      default: false
    }),
    target: Flags.string({
      char: 't',
      summary: 'Custom installation directory',
      description: 'Specify a custom directory to install commands. Overrides --global.'
    }),
    force: Flags.boolean({
      char: 'f',
      summary: 'Overwrite existing files without confirmation',
      description: 'Skip confirmation prompts when overwriting existing command files.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(ClaudeInit);

    // Determine target directory
    const targetDir = this.getTargetDirectory(flags.target, flags.global);
    const commandsDir = path.join(targetDir, '.claude', 'commands');

    // Check if already installed
    const exists = await fs.pathExists(commandsDir);
    if (exists && !flags.force) {
      this.log(`Commands already exist at: ${commandsDir}`);
      this.log('Use `mgtd claude update` to update existing commands.');
      this.log('Or use `--force` to overwrite without confirmation.');
      return;
    }

    // Get template directory
    const templateDir = this.getTemplateDirectory();

    // Copy templates
    try {
      await fs.ensureDir(commandsDir);
      await fs.copy(templateDir, commandsDir, { overwrite: flags.force });

      this.log(`✅ Claude Code commands installed successfully!`);
      this.log(`📁 Location: ${commandsDir}`);
      this.log('');
      this.log('Available commands:');
      this.log('  /gtd:inbox-review    - Review unlabeled memos');
      this.log('  /gtd:next-actions    - List tasks with status:next');
      this.log('  /gtd:weekly-review   - Conduct weekly GTD review');
      this.log('  /gtd:clarify <id>    - Clarify a memo');
      this.log('  /quick:memo <text>   - Quick memo creation');
      this.log('  /quick:task <title>  - Quick task creation');
      this.log('  /promote <id>        - Promote memo to task');
      this.log('');
      this.log('📖 See README.md in the commands directory for details.');
    } catch (error) {
      this.error(`Failed to install commands: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getTargetDirectory(customTarget: string | undefined, isGlobal: boolean): string {
    if (customTarget) {
      return path.resolve(customTarget);
    }

    if (isGlobal) {
      return homedir();
    }

    return process.cwd();
  }

  private getTemplateDirectory(): string {
    // Get the directory where this file is located
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // Navigate to templates/claude-commands from dist/commands/claude
    return path.resolve(__dirname, '../../../templates/claude-commands');
  }
}
