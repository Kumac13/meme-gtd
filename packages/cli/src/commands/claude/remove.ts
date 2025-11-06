import { Command, Flags } from '@oclif/core';
import fs from 'fs-extra';
import path from 'node:path';
import { homedir } from 'node:os';
import * as readline from 'node:readline/promises';

export default class ClaudeRemove extends Command {
  static summary = 'Remove installed Claude Code slash commands';
  static description =
    'Delete all installed slash commands from the target directory.';

  static examples = [
    '$ mgtd claude remove --global',
    '$ mgtd claude remove',
    '$ mgtd claude remove --yes'
  ];

  static flags = {
    global: Flags.boolean({
      char: 'g',
      summary: 'Remove globally installed commands',
      description: 'Remove commands from ~/.claude/commands/',
      default: false
    }),
    target: Flags.string({
      char: 't',
      summary: 'Custom installation directory',
      description: 'Specify a custom directory to remove commands from.'
    }),
    yes: Flags.boolean({
      char: 'y',
      summary: 'Skip confirmation prompt',
      description: 'Remove commands without asking for confirmation.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(ClaudeRemove);

    // Determine target directory
    const targetDir = this.getTargetDirectory(flags.target, flags.global);
    const commandsDir = path.join(targetDir, '.claude', 'commands');

    // Check if installed
    const exists = await fs.pathExists(commandsDir);
    if (!exists) {
      this.log(`⚠️  No commands found at: ${commandsDir}`);
      this.log('Nothing to remove.');
      return;
    }

    // Confirmation prompt
    if (!flags.yes) {
      const confirmed = await this.confirm(`Remove all commands from ${commandsDir}?`);
      if (!confirmed) {
        this.log('Cancelled.');
        return;
      }
    }

    // Remove commands directory
    try {
      await fs.remove(commandsDir);

      this.log(`✅ Claude Code commands removed successfully!`);
      this.log(`📁 Removed: ${commandsDir}`);
    } catch (error) {
      this.error(`Failed to remove commands: ${error instanceof Error ? error.message : String(error)}`);
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

  private async confirm(message: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      const answer = await rl.question(`${message} [y/N] `);
      return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    } finally {
      rl.close();
    }
  }
}
