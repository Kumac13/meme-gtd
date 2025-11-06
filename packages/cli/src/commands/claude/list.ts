import { Command, Flags } from '@oclif/core';
import fs from 'fs-extra';
import path from 'node:path';
import { homedir } from 'node:os';
import { glob } from 'glob';

export default class ClaudeList extends Command {
  static summary = 'List installed Claude Code slash commands';
  static description =
    'Display all installed slash commands and their locations.';

  static examples = [
    '$ mgtd claude list --global',
    '$ mgtd claude list',
    '$ mgtd claude list --json'
  ];

  static flags = {
    global: Flags.boolean({
      char: 'g',
      summary: 'List globally installed commands',
      description: 'List commands in ~/.claude/commands/',
      default: false
    }),
    target: Flags.string({
      char: 't',
      summary: 'Custom installation directory',
      description: 'Specify a custom directory to list commands from.'
    }),
    json: Flags.boolean({
      char: 'j',
      summary: 'Output in JSON format',
      description: 'Return the command list in JSON format.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(ClaudeList);

    // Determine target directory
    const targetDir = this.getTargetDirectory(flags.target, flags.global);
    const commandsDir = path.join(targetDir, '.claude', 'commands');

    // Check if installed
    const exists = await fs.pathExists(commandsDir);
    if (!exists) {
      if (flags.json) {
        this.log(JSON.stringify({ commands: [], location: commandsDir, installed: false }, null, 2));
      } else {
        this.log(`⚠️  No commands found at: ${commandsDir}`);
        this.log('Run `mgtd claude init` to install commands first.');
      }
      return;
    }

    // Find all .md files
    try {
      const pattern = path.join(commandsDir, '**', '*.md');
      const files = await glob(pattern, { ignore: '**/README.md' });

      const commands = files.map(file => {
        const relativePath = path.relative(commandsDir, file);
        const commandName = this.getCommandName(relativePath);
        return {
          name: commandName,
          path: relativePath,
          fullPath: file
        };
      });

      if (flags.json) {
        this.log(JSON.stringify({
          commands,
          location: commandsDir,
          installed: true,
          count: commands.length
        }, null, 2));
      } else {
        this.log(`📁 Commands location: ${commandsDir}`);
        this.log('');
        this.log(`Found ${commands.length} command(s):`);
        this.log('');

        commands.forEach(cmd => {
          this.log(`  /${cmd.name.padEnd(25)} → ${cmd.path}`);
        });
      }
    } catch (error) {
      this.error(`Failed to list commands: ${error instanceof Error ? error.message : String(error)}`);
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

  private getCommandName(relativePath: string): string {
    // Convert path to command name
    // e.g., "gtd/inbox-review.md" → "gtd:inbox-review"
    const withoutExt = relativePath.replace(/\.md$/, '');
    return withoutExt.replace(/\//g, ':');
  }
}
