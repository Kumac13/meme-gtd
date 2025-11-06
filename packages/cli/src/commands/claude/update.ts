import { Command, Flags } from '@oclif/core';
import fs from 'fs-extra';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export default class ClaudeUpdate extends Command {
  static summary = 'Update installed Claude Code slash commands';
  static description =
    'Update existing slash commands with the latest versions from meme-gtd templates.';

  static examples = [
    '$ mgtd claude update --global',
    '$ mgtd claude update',
    '$ mgtd claude update --target ~/my-project'
  ];

  static flags = {
    global: Flags.boolean({
      char: 'g',
      summary: 'Update globally installed commands',
      description: 'Update commands in ~/.claude/commands/',
      default: false
    }),
    target: Flags.string({
      char: 't',
      summary: 'Custom installation directory',
      description: 'Specify a custom directory containing commands to update.'
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(ClaudeUpdate);

    // Determine target directory
    const targetDir = this.getTargetDirectory(flags.target, flags.global);
    const commandsDir = path.join(targetDir, '.claude', 'commands');

    // Check if installed
    const exists = await fs.pathExists(commandsDir);
    if (!exists) {
      this.log(`⚠️  No commands found at: ${commandsDir}`);
      this.log('Run `mgtd claude init` to install commands first.');
      return;
    }

    // Get template directory
    const templateDir = this.getTemplateDirectory();

    // Copy templates (overwrite)
    try {
      await fs.copy(templateDir, commandsDir, { overwrite: true });

      this.log(`✅ Claude Code commands updated successfully!`);
      this.log(`📁 Location: ${commandsDir}`);
      this.log('');
      this.log('All commands have been updated to the latest version.');
    } catch (error) {
      this.error(`Failed to update commands: ${error instanceof Error ? error.message : String(error)}`);
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
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(__dirname, '../../../templates/claude-commands');
  }
}
