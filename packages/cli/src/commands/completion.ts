import { Command, Flags } from '@oclif/core';
import fs from 'fs-extra';
import path from 'node:path';
import {
  readCompletionScript,
  resolveCompletionPath,
  shells,
  SupportedShell
} from '../resources/completions.js';

export default class Completion extends Command {
  static summary = 'Generate shell completion scripts';
  static description =
    'Output or install shell completion scripts for mgtd. Use --target to write to a file or pipe to source.';
  static examples = [
    '$ mgtd completion --shell bash >> ~/.bashrc',
    '$ mgtd completion --shell zsh --target ~/.local/share/mgtd/mgtd.zsh',
    '$ mgtd completion --shell fish --print-path'
  ];

  static flags = {
    shell: Flags.string({
      char: 's',
      summary: 'Target shell',
      description: 'Specify which shell completion script to emit.',
      options: shells,
      default: 'bash'
    }),
    target: Flags.string({
      char: 't',
      summary: 'Write output to this file',
      description: 'If provided, the completion script will be written to the given path.'
    }),
    printPath: Flags.boolean({
      char: 'p',
      summary: 'Print the bundled script path',
      description: 'Show the absolute path to the built-in completion script for the selected shell.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(Completion);
    const shell = flags.shell as SupportedShell;

    const script = readCompletionScript(shell);
    if (flags.printPath) {
      const resolvedPath = resolveCompletionPath(shell);
      this.log(resolvedPath);
      if (!flags.target) {
        return;
      }
    }

    if (flags.target) {
      const outputPath = path.resolve(flags.target);
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, script, 'utf-8');
      this.log(`Completion script written to ${outputPath}`);
      return;
    }

    this.log(script);
  }

}
