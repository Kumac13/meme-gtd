import { Command, Flags } from '@oclif/core';
import fsExtra from 'fs-extra';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { readJsonSync } = fsExtra;

export default class Version extends Command {
  static summary = 'Show version and environment information';
  static description =
    'Display detailed version information including CLI version, Node.js version, and platform details.';
  static usage = ['<%= command.id %> [--json]'];
  static examples = [
    '$ mgtd version',
    '$ mgtd version --json'
  ];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Output version information as JSON',
      description: 'Format the output as JSON for programmatic consumption.',
      default: false
    })
  } as const;

  async run(): Promise<void> {
    const { flags } = await this.parse(Version);

    try {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const pkgPath = join(__dirname, '../../package.json');
      const pkg = readJsonSync(pkgPath);

      if (flags.json) {
        const versionInfo = {
          version: pkg.version,
          name: pkg.name,
          node: {
            version: process.version,
            required: pkg.engines?.node || 'unknown'
          },
          platform: process.platform,
          arch: process.arch
        };
        this.log(JSON.stringify(versionInfo, null, 2));
      } else {
        this.log(`mgtd version ${pkg.version}`);
        this.log(`Node.js ${process.version}`);
        this.log(`Platform: ${process.platform}-${process.arch}`);
      }
    } catch (error) {
      this.error('Could not read version information', { exit: 1 });
    }
  }
}
